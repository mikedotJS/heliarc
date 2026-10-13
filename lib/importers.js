// Reads bookmarks, history and passwords from other browsers. Nothing here touches the app's state: it only returns plain data.
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto')
const { execFile } = require('child_process'), run = (cmd, args, env) => new Promise((ok, no) => execFile(cmd, args, { env: { ...process.env, ...env }, timeout: 120000, windowsHide: true }, (e, out) => e ? no(e) : ok(out.trim())))
const { DatabaseSync } = require('node:sqlite')
const Papa = require('papaparse')
const { Parser } = require('htmlparser2')

const HOME = os.homedir(), MAC = process.platform === 'darwin'
const SUPPORT = MAC ? path.join(HOME, 'Library', 'Application Support') : process.env.LOCALAPPDATA || ''
const ROAMING = MAC ? SUPPORT : process.env.APPDATA || ''
// where each browser keeps its profile (Chromium browsers share one layout)
const BROWSERS = {
  chrome: { name: 'Chrome', kind: 'chromium', dir: MAC ? 'Google/Chrome' : 'Google/Chrome/User Data', keychain: ['Chrome Safe Storage', 'Chrome'] },
  arc: { name: 'Arc', kind: 'chromium', dir: MAC ? 'Arc/User Data' : '', keychain: ['Arc Safe Storage', 'Arc'] },
  edge: { name: 'Edge', kind: 'chromium', dir: MAC ? 'Microsoft Edge' : 'Microsoft/Edge/User Data', keychain: ['Microsoft Edge Safe Storage', 'Microsoft Edge'] },
  brave: { name: 'Brave', kind: 'chromium', dir: MAC ? 'BraveSoftware/Brave-Browser' : 'BraveSoftware/Brave-Browser/User Data', keychain: ['Brave Safe Storage', 'Brave'] },
  firefox: { name: 'Firefox', kind: 'firefox', dir: MAC ? 'Firefox/Profiles' : 'Mozilla/Firefox/Profiles', roaming: true },
  safari: { name: 'Safari', kind: 'safari', file: path.join(HOME, 'Library', 'Safari', 'History.db') },
}
const exists = p => { try { return fs.existsSync(p) } catch { return false } }

// the files of the first profile found, per kind of data
function locate(id) {
  const b = BROWSERS[id]; if (!b) return {}
  if (b.kind === 'safari') return MAC && exists(b.file) ? { history: b.file } : {}
  const root = path.join(b.roaming ? ROAMING : SUPPORT, b.dir); if (!b.dir || !exists(root)) return {}
  if (b.kind === 'chromium') { const d = path.join(root, 'Default'); return { history: exists(path.join(d, 'History')) && path.join(d, 'History'), bookmarks: exists(path.join(d, 'Bookmarks')) && path.join(d, 'Bookmarks'), passwords: (files => files.length && files)(['Login Data', 'Login Data For Account'].map(n => path.join(d, n)).filter(exists)) } } // the second one holds the passwords saved to a Google account
  const profile = fs.readdirSync(root).map(n => path.join(root, n, 'places.sqlite')).filter(exists).sort((a, c) => fs.statSync(c).mtimeMs - fs.statSync(a).mtimeMs)[0]
  return profile ? { history: profile, bookmarks: profile } : {}
}
const detect = () => Object.entries(BROWSERS).map(([id, b]) => ({ id, name: b.name, ...locate(id) })).filter(b => b.history || b.bookmarks || b.passwords)

// browsers keep their database locked while they run: read a copy
function query(file, sql) {
  const tmp = path.join(os.tmpdir(), `heliarc-import-${process.pid}-${Date.now()}.sqlite`)
  fs.copyFileSync(file, tmp)
  for (const ext of ['-wal', '-shm']) if (exists(file + ext)) fs.copyFileSync(file + ext, tmp + ext)
  let db
  try { // Chrome's microsecond timestamps don't fit in a double exactly: read integers as BigInt, then back to numbers (a few microseconds of rounding is fine)
    db = new DatabaseSync(tmp, { readOnly: true }); const st = db.prepare(sql); st.setReadBigInts(true)
    return st.all().map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))) } finally { db?.close(); for (const ext of ['', '-wal', '-shm']) fs.rmSync(tmp + ext, { force: true }) }
}
const web = u => /^https?:\/\//i.test(u)

// -> [{ url, title, at }] newest first; `at` is in ms since 1970
function history(id, file = locate(id).history, limit = 3000) {
  const kind = BROWSERS[id]?.kind
  if (kind === 'chromium') return query(file, `select url, title, last_visit_time t from urls where last_visit_time > 0 order by last_visit_time desc limit ${limit}`).filter(r => web(r.url)).map(r => ({ url: r.url, title: r.title || '', at: Math.round(Number(r.t) / 1000 - 11644473600000) }))
  if (kind === 'firefox') return query(file, `select url, title, last_visit_date t from moz_places where last_visit_date is not null order by last_visit_date desc limit ${limit}`).filter(r => web(r.url)).map(r => ({ url: r.url, title: r.title || '', at: Math.round(Number(r.t) / 1000) }))
  if (kind === 'safari') return query(file, `select i.url url, v.title title, max(v.visit_time) t from history_items i join history_visits v on v.history_item = i.id group by i.id order by t desc limit ${limit}`).filter(r => web(r.url)).map(r => ({ url: r.url, title: r.title || '', at: Math.round((Number(r.t) + 978307200) * 1000) }))
  throw new Error('Unknown browser')
}

// -> [{ title, url, folder }] where folder is the name of the top-level folder it lives in ('' for loose ones)
function chromiumBookmarks(file) {
  const out = [], root = JSON.parse(fs.readFileSync(file, 'utf8')).roots || {}
  const walk = (n, top) => { if (n.type === 'url' && web(n.url)) out.push({ title: n.name || '', url: n.url, folder: top }); else for (const c of n.children || []) walk(c, top || (c.type === 'folder' ? c.name : '')) }
  for (const r of Object.values(root)) if (r && r.children) for (const c of r.children) c.type === 'folder' ? walk(c, c.name) : walk(c, '')
  return out
}
function firefoxBookmarks(file) {
  const rows = query(file, `select b.id, b.parent, b.type, b.title, p.url url from moz_bookmarks b left join moz_places p on p.id = b.fk where b.type in (1, 2)`)
  const byId = new Map(rows.map(r => [r.id, r])) // ids 1-6 are Firefox's own root folders (root, menu, toolbar, tags, other, mobile)
  const top = r => { let n = r; while (n && !(byId.get(n.parent)?.id <= 6)) n = byId.get(n.parent); return n?.type === 2 ? n.title : '' }
  return rows.filter(r => r.type === 1 && web(r.url)).map(r => ({ title: r.title || '', url: r.url, folder: top(r) || '' }))
}
// Netscape bookmarks file: what Chrome, Firefox, Safari and Edge all export
function htmlBookmarks(text) {
  const out = [], names = []; let depth = 0, name = null, link = null
  const p = new Parser({
    onopentag(tag, a) { if (tag === 'dl') depth++; if (tag === 'h3') name = ''; if (tag === 'a') link = { url: a.href, title: '' } },
    ontext(t) { if (name !== null) name += t; if (link) link.title += t },
    onclosetag(tag) {
      if (tag === 'h3') { names[depth] = name.trim(); name = null }
      if (tag === 'a' && link) { if (web(link.url)) out.push({ title: link.title.trim(), url: link.url, folder: depth >= 3 ? names[2] || '' : '' }); link = null }
      if (tag === 'dl') { names.length = Math.min(names.length, depth); depth-- }
    },
  }, { lowerCaseTags: true })
  p.write(text); p.end(); return out
}
function bookmarks(id, file = locate(id).bookmarks) {
  if (/\.html?$/i.test(file)) return htmlBookmarks(fs.readFileSync(file, 'utf8'))
  if (BROWSERS[id]?.kind === 'firefox' || /\.sqlite$/i.test(file)) return firefoxBookmarks(file)
  return chromiumBookmarks(file)
}

// Passwords CSV as exported by Chrome / Edge / Brave (name,url,username,password), Firefox (url,username,password,…) and Safari (Title,URL,Username,Password,…)
function passwords(text) {
  const { data } = Papa.parse(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase() })
  return data.map(r => ({ origin: (() => { try { return new URL(r.url || r.origin || r.hostname).origin } catch { return '' } })(), user: r.username || r.login || '', pass: r.password || '' })).filter(r => r.origin && r.pass)
}

// ---- saved passwords of the Chromium browsers (Chrome, Edge, Brave, Arc), read the way they protect them ----
// Mac: AES-128-CBC, key derived from the "<Browser> Safe Storage" item of the login keychain (macOS asks the user to allow it).
// Windows: AES-256-GCM, key stored in "Local State" and protected by the user's Windows account (DPAPI). Chrome 127+ on Windows
// ("v20", app-bound) can only be opened by Chrome itself: those are counted and left to the CSV export.
const macKey = secret => crypto.pbkdf2Sync(secret, 'saltysalt', 1003, 16, 'sha1')
function decryptChromium(blob, key, mac = MAC) {
  const b = Buffer.from(blob), tag = b.subarray(0, 3).toString()
  if (!/^v1[01]$/.test(tag)) return null
  if (mac) { const d = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, 0x20)); return Buffer.concat([d.update(b.subarray(3)), d.final()]).toString('utf8') }
  const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(3, 15)); d.setAuthTag(b.subarray(b.length - 16))
  return Buffer.concat([d.update(b.subarray(15, b.length - 16)), d.final()]).toString('utf8')
}
// -> { list: [{ origin, user, pass }], skipped } for a Login Data file and the key that opens it
function chromiumLogins(file, key, mac = MAC) {
  const list = []; let skipped = 0
  for (const r of query(file, "select origin_url, username_value, password_value from logins where blacklisted_by_user = 0 and length(password_value) > 0")) {
    let pass = null; try { pass = decryptChromium(r.password_value, key, mac) } catch {}
    const origin = (() => { try { return new URL(r.origin_url).origin } catch { return '' } })()
    if (pass === null || !/^https?:/.test(origin)) { skipped++; continue }
    list.push({ origin, user: r.username_value || '', pass })
  }
  return { list, skipped }
}
async function chromiumKey(id) {
  const b = BROWSERS[id]
  if (MAC) { const [service, account] = b.keychain; return macKey(await run('security', ['find-generic-password', '-w', '-s', service, '-a', account])) }
  const state = JSON.parse(fs.readFileSync(path.join(SUPPORT, b.dir, 'Local State'), 'utf8')), enc = Buffer.from(state.os_crypt.encrypted_key, 'base64').subarray(5) // "DPAPI" prefix
  const ps = "Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($env:HELIARC_K), $null, 'CurrentUser'))"
  return Buffer.from(await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { HELIARC_K: enc.toString('base64') }), 'base64')
}
async function browserPasswords(id) {
  const files = locate(id).passwords; if (!files) throw new Error('No saved passwords found')
  let key; try { key = await chromiumKey(id) } catch (e) { throw new Error(MAC ? `${BROWSERS[id].name}’s password key wasn’t released (you need to click Allow in the macOS window)` : `Couldn’t open ${BROWSERS[id].name}’s password key`) }
  const all = files.map(f => chromiumLogins(f, key))
  return { list: all.flatMap(r => r.list), skipped: all.reduce((n, r) => n + r.skipped, 0) }
}

module.exports = { BROWSERS, detect, history, bookmarks, passwords, browserPasswords, chromiumLogins, decryptChromium, macKey, htmlBookmarks, chromiumBookmarks }
