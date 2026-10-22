// Chrome extensions: install from the Chrome Web Store (or a CRX buffer) into the user data folder and load them in every space.
const { app } = require('electron'), fs = require('fs'), path = require('path'), crypto = require('crypto')
const { unzipSync } = require('fflate')

const dir = () => path.join(app.getPath('userData'), 'extensions')
const STORE = id => `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${process.versions.chrome}&acceptformat=crx2,crx3&x=id%3D${id}%26uc`
const idOf = der => [...crypto.createHash('sha256').update(der).digest().subarray(0, 16)].map(b => 'abcdefghijklmnop'[b >> 4] + 'abcdefghijklmnop'[b & 15]).join('')
const parseId = s => (s.match(/\b[a-p]{32}\b/) || [])[0]

function* fields(buf) { // minimal protobuf reader: yields [tag, bytes] for length-delimited fields
  let i = 0
  const varint = () => { let v = 0, s = 0, b; do { b = buf[i++]; v += (b & 127) * 2 ** s; s += 7 } while (b & 128); return v }
  while (i < buf.length) {
    const key = varint(), wire = key & 7
    if (wire === 2) { const n = varint(); yield [key >> 3, buf.subarray(i, i + n)]; i += n } else if (wire === 0) varint(); else return
  }
}
function split(crx) { // -> { zip, key } where key is the base64 public key whose hash is the extension id (so the id stays the store id)
  if (crx.toString('latin1', 0, 4) !== 'Cr24') throw new Error('Not a Chrome extension package')
  if (crx.readUInt32LE(4) !== 3) { // CRX2: magic, version, key length, signature length, key, signature, zip
    const pk = crx.readUInt32LE(8), sig = crx.readUInt32LE(12)
    return { zip: crx.subarray(16 + pk + sig), key: crx.subarray(16, 16 + pk).toString('base64') }
  }
  const head = crx.subarray(12, 12 + crx.readUInt32LE(8)), keys = []
  for (const [tag, b] of fields(head)) if (tag === 2 || tag === 3) for (const [t, k] of fields(b)) if (t === 1) keys.push(k)
  let want = null // signed_header_data.crx_id is the id as 16 raw bytes
  for (const [tag, b] of fields(head)) if (tag === 10000) for (const [t, d] of fields(b)) if (t === 1) want = [...d].map(x => 'abcdefghijklmnop'[x >> 4] + 'abcdefghijklmnop'[x & 15]).join('')
  const key = keys.find(k => idOf(k) === want) || keys[0]
  return { zip: crx.subarray(12 + crx.readUInt32LE(8)), key: key?.toString('base64') ?? null }
}
function unpack(zip, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const [name, data] of Object.entries(unzipSync(new Uint8Array(zip)))) {
    const p = path.join(to, name)
    if (name.endsWith('/') || !p.startsWith(to + path.sep)) continue // folders are implied; never write outside the target
    fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data)
  }
}
// Loads one extension folder into every session; throws if Chromium refuses it.
async function load(d, sessions) {
  // "use_dynamic_url" makes chrome.runtime.getURL return a random-GUID address that Electron can't resolve, which breaks iframes such as Bitwarden's inline menu
  const mf = path.join(d, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(mf, 'utf8').replace(/^﻿/, ''))
  if (JSON.stringify(manifest.web_accessible_resources)?.includes('use_dynamic_url')) {
    for (const r of manifest.web_accessible_resources) delete r.use_dynamic_url
    fs.writeFileSync(mf, JSON.stringify(manifest))
  }
  let first
  for (const ses of sessions) { const e = await ses.extensions.loadExtension(d); first ??= e }
  return first
}
const unload = async (id, sessions) => { for (const ses of sessions) if (ses.extensions.getAllExtensions().some(x => x.id === id)) await ses.extensions.removeExtension(id) }

// Installs a CRX buffer under extensions/<id>/ and loads it into the given sessions. Returns { id, name, version }.
// An older copy stays in place until the new one has loaded.
async function installCrx(crx, sessions) {
  const { zip, key } = split(crx), root = dir()
  fs.mkdirSync(root, { recursive: true })
  const tmp = fs.mkdtempSync(path.join(root, '.new-')) // same filesystem as the destination, so the final rename can't fail with EXDEV
  let to, old, placed, unloaded
  try {
    unpack(zip, tmp)
    const mf = path.join(tmp, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(mf, 'utf8').replace(/^﻿/, ''))
    if (key) manifest.key = key
    fs.writeFileSync(mf, JSON.stringify(manifest))
    const id = key ? idOf(Buffer.from(key, 'base64')) : crypto.randomBytes(16).toString('hex')
    to = path.join(root, id)
    if (fs.existsSync(to)) { const o = path.join(root, '.old-' + id); unloaded = true; await unload(id, sessions); fs.rmSync(o, { recursive: true, force: true }); fs.renameSync(to, o); old = o }
    fs.renameSync(tmp, to); placed = true
    const e = await load(to, sessions)
    failed.delete(id)
    if (old) fs.rmSync(old, { recursive: true, force: true })
    return { id: e.id, name: e.name, version: manifest.version }
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true })
    if (placed) { await unload(path.basename(to), sessions).catch(() => {}); fs.rmSync(to, { recursive: true, force: true }) }
    if (old) { fs.renameSync(old, to); await load(to, sessions).catch(() => {}) } // put the previous version back
    else if (unloaded) await loadOne(path.basename(to), sessions) // the update stopped before the old version was moved: it is still in place, load it again
    throw new Error(`Couldn’t install the extension: ${err.message}`)
  }
}
async function installFromStore(input, sessions) {
  const id = parseId(input.trim()); if (!id) throw new Error('Paste a Chrome Web Store link or a 32-letter extension ID')
  const r = await fetch(STORE(id), { signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(r.status === 204 || r.status === 404 ? 'Extension not found in the Chrome Web Store' : `Chrome Web Store answered ${r.status}`)
  return installCrx(Buffer.from(await r.arrayBuffer()), sessions)
}
const failed = new Map() // extensions that are installed but wouldn't start: { id, name, error }
const nameOf = n => { try { return JSON.parse(fs.readFileSync(path.join(dir(), n, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')).name } catch { return n } }
const failures = () => [...failed.values()]
async function loadOne(n, sessions) { try { await load(path.join(dir(), n), sessions); failed.delete(n) } catch (e) { failed.set(n, { id: n, name: nameOf(n), error: e.message }); console.warn('extension', n, e.message) } }
async function retry(id, sessions) { if (failed.has(id)) await loadOne(id, sessions); return !failed.has(id) }
async function loadInstalled(sessions) {
  if (!fs.existsSync(dir())) return
  for (const n of fs.readdirSync(dir()).filter(x => x.startsWith('.'))) { // leftovers of an interrupted install: keep the previous version, drop the rest
    const p = path.join(dir(), n), back = path.join(dir(), n.slice(5))
    n.startsWith('.old-') && !fs.existsSync(back) ? fs.renameSync(p, back) : fs.rmSync(p, { recursive: true, force: true })
  }
  for (const n of fs.readdirSync(dir())) await loadOne(n, sessions)
}
async function remove(id, sessions) {
  failed.delete(id); await unload(id, sessions).catch(() => {})
  const p = path.join(dir(), id); if (path.basename(p) === id && !id.startsWith('.') && fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}
const list = ses => ses.extensions.getAllExtensions().map(({ id, name, version }) => ({ id, name, version }))
module.exports = { installFromStore, installCrx, loadInstalled, loadOne, remove, list, failures, retry, idOf, split }
