const { app, BaseWindow, WebContentsView, ipcMain, session, Menu, shell, safeStorage, clipboard } = require('electron')
const path = require('path'), fs = require('fs'), os = require('os')
const { ElectronBlocker } = require('@ghostery/adblocker-electron')
const { resolve } = require('./bangs')
const store = require('./lib/store')
const keys = require('./lib/shortcuts')
const ext = require('./lib/extensions')

const TEST = process.argv.some(a => /^--(selftest|motioncheck)/.test(a))
if (process.env.HELIARC_USER_DATA) app.setPath('userData', process.env.HELIARC_USER_DATA)
if (TEST) { // tests never touch the real Downloads folder (nor, unless told otherwise, the real profile)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heliarc-test-'))
  if (!process.env.HELIARC_USER_DATA) app.setPath('userData', path.join(tmp, 'data'))
  app.setPath('downloads', path.join(tmp, 'downloads')); fs.mkdirSync(app.getPath('downloads'))
}

const SIDEBAR = 262, GAP = 8, EDGE = 6, PEEKBAR = 44, LITTLEBAR = 44
const ICON = path.join(__dirname, 'assets', 'icon.png')
const NEWTAB = 'file://' + path.join(__dirname, 'ui', 'newtab.html').replace(/\\/g, '/')
const TABPRELOAD = path.join(__dirname, 'tabpreload.js')
const SPACES = [ // one browser profile (cookies, logins) per space
  { name: 'Home', icon: 'house', c1: '#5b4bff', c2: '#c04bff', partition: 'persist:main' },
  { name: 'Work', icon: 'briefcase', c1: '#0aa6a6', c2: '#2b6fff', partition: 'persist:work' },
  { name: 'Fun', icon: 'gamepad-2', c1: '#ff7a3d', c2: '#ff3d77', partition: 'persist:fun' },
]
const ZOOMS = [.25, .33, .5, .67, .75, .8, .9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]
const DEFAULTS = { archiveHours: 12, routes: [], shortcuts: {}, autoPip: true, littleExternal: true, pwNever: [] }
// Picture-in-picture for the biggest playing, unmuted video (needs a user gesture, which executeJavaScript can claim)
const PIP_ON = `(async () => { const v = [...document.querySelectorAll('video')].filter(v => !v.paused && !v.ended && !v.muted && v.readyState > 2 && v.videoWidth && !v.disablePictureInPicture).sort((a, b) => b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight)[0]; if (!v || document.pictureInPictureElement) return false; await v.requestPictureInPicture(); return true })()`
const PIP_OFF = `document.pictureInPictureElement && document.exitPictureInPicture()`
const MEDIA_TOGGLE = `(() => { const m = [...document.querySelectorAll('video,audio')]; const on = m.filter(x => !x.paused); if (on.length) { on.forEach(x => x.pause()); return false } (m.find(x => x.currentTime > 0) || m[0])?.play(); return true })()`

let win, ui, cmd, panel, find, peekUi, edge, little
let tabs = [], folders = [], archive = [], history = [], downloads = [], vault = [], profile = {}, settings = { ...DEFAULTS }
let active = null, space = 0, nextId = 1, blocked = 0, blockerState = 'loading'
let cmdOpen = false, panelOpen = false, findOpen = false, findText = '', recording = false
let sidebar = true, floating = false, split = null, peek = null, mediaTab = null, pwPending = null, soon = null
const dls = new Map(), configured = new Set()

const byId = id => tabs.find(t => t.id === id)
const cur = () => byId(active)
const isShown = id => id === active || !!split?.includes(id)
const tabOf = wc => tabs.find(t => t.view?.webContents === wc)
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const zoneOf = t => t.fav ? 'fav' : t.folder ? 'f' + t.folder : t.pinned ? 'pinned' : 'list'
const snapshot = () => ({
  tabs: tabs.map(({ id, title, url, icon, pinned, fav, folder, space, muted, last }) => ({ id, title, url, icon, pinned, fav, folder, space, muted, last })),
  folders, active, space, sidebar, archive, settings,
})
const push = () => {
  if (!ui) return
  const nav = cur()?.view?.webContents.navigationHistory
  const s = {
    active, space, spaces: SPACES, blocked, blockerState, canBack: nav?.canGoBack() ?? false, canFwd: nav?.canGoForward() ?? false,
    sidebar, split, folders, archive: archive.slice(0, 200), downloads: downloads.slice(0, 50), settings, keys: keys.resolve(settings.shortcuts),
    labels: Object.fromEntries(Object.entries(keys.ACTIONS).map(([a, [l]]) => [a, l])), canSavePw: safeStorage.isEncryptionAvailable(),
    media: byId(mediaTab) ? { id: mediaTab, playing: !!byId(mediaTab).playing } : null,
    pw: pwPending && { tab: pwPending.tab, origin: pwPending.origin, user: pwPending.user, update: pwPending.update },
    tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, icon: t.icon, loading: t.loading, muted: t.muted, asleep: t.asleep, error: t.error, pinned: t.pinned, fav: t.fav, folder: t.folder, space: t.space, zoom: t.view?.webContents.getZoomFactor() ?? 1 })),
  }
  for (const v of [ui, cmd, panel]) if (!v.webContents.isDestroyed()) v.webContents.send('state', s)
  store.save('session', snapshot())
}
const pushSoon = () => { soon ??= setTimeout(() => { soon = null; push() }, 250) }

function content() {
  const { width, height } = win.getContentBounds(), x = sidebar ? SIDEBAR : GAP
  return { x, y: GAP, w: width - x - GAP, h: height - GAP * 2, width, height }
}
function layout() {
  const c = content(), full = { x: 0, y: 0, width: c.width, height: c.height }
  ui.setBounds(floating ? { x: 0, y: 0, width: SIDEBAR, height: c.height } : full)
  for (const v of [cmd, panel, peekUi]) v.setBounds(full)
  edge.setBounds({ x: 0, y: 0, width: EDGE, height: c.height })
  find.setBounds({ x: c.x + c.w - 392, y: c.y + 4, width: 380, height: 64 })
  const ids = split || [], half = Math.floor((c.w - GAP) / 2)
  tabs.forEach(t => {
    const i = ids.indexOf(t.id)
    t.view?.setBounds(i < 0 ? { x: c.x, y: c.y, width: c.w, height: c.h } : { x: c.x + i * (half + GAP), y: c.y, width: i ? c.w - half - GAP : half, height: c.h })
  })
  if (peek) { const r = peekRect(); peek.view.setBounds({ x: r.x, y: r.y + PEEKBAR, width: r.w, height: r.h - PEEKBAR }) }
}
function stack() { // z-order: sidebar < pages < peek < floating sidebar < edge < find < panel < command bar
  const order = [!floating && ui, ...tabs.map(t => t.view), peekUi, peek?.view, floating && ui, edge, find, panel, cmd]
  order.forEach(v => v && win.contentView.addChildView(v))
}
const refresh = () => { tabs.forEach(t => t.view?.setVisible(isShown(t.id))); layout(); push() }

function makeView(tab) {
  const view = new WebContentsView({ webPreferences: { partition: SPACES[tab.space].partition, sandbox: true, contextIsolation: true, preload: TABPRELOAD } })
  const wc = view.webContents
  view.setBorderRadius(12)
  tab.view = view; tab.asleep = false
  wc.setWindowOpenHandler(({ url, disposition, features }) => { disposition === 'new-window' && !features ? openPeek(url) : newTab(url); return { action: 'deny' } }) // Shift+click = Peek
  wc.on('page-title-updated', (_, t) => { tab.title = t; if (history[0]?.url === wc.getURL()) { history[0].title = t; store.save('history', history) } push() })
  wc.on('page-favicon-updated', (_, icons) => { tab.icon = icons[0]; push() })
  wc.on('did-start-loading', () => { tab.loading = true; tab.error = null; push() })
  wc.on('did-stop-loading', () => { tab.loading = false; push() })
  wc.on('did-navigate', (_, u) => { tab.url = u.startsWith('file:') ? '' : u; visit(tab, u); push() })
  wc.on('did-navigate-in-page', (_, u) => { tab.url = u; push() })
  wc.on('did-fail-load', (_, code, desc, url, isMain) => {
    if (isMain && code !== -3) { tab.error = `${desc} — ${url}`; tab.loading = false; push() }
  })
  wc.on('before-input-event', shortcut)
  wc.on('focus', () => { if (split?.includes(tab.id) && active !== tab.id) { active = tab.id; push() } })
  wc.on('media-started-playing', () => { tab.playing = true; mediaTab = tab.id; push() })
  wc.on('media-paused', () => { tab.playing = false; push() })
  wc.on('zoom-changed', (_, dir) => { if (tab.id === active) zoom(dir === 'in' ? 1 : -1) })
  wc.on('found-in-page', (_, r) => find.webContents.send('found', { active: r.activeMatchOrdinal, total: r.matches }))
  wc.on('context-menu', (_, p) => pageMenu(wc, p))
  wc.setAudioMuted(tab.muted)
  win.contentView.addChildView(view)
  stack()
  wc.loadURL(tab.url || NEWTAB + '#' + encodeURIComponent(keys.resolve(settings.shortcuts).editAddress))
  layout()
}
function pageMenu(wc, p) {
  Menu.buildFromTemplate([
    ...(p.linkURL ? [{ label: 'Open link in new tab', click: () => newTab(p.linkURL) }, { label: 'Open link in peek', click: () => openPeek(p.linkURL) }, { label: 'Copy link address', click: () => clipboard.writeText(p.linkURL) }, { type: 'separator' }] : []),
    ...(p.mediaType === 'image' ? [{ label: 'Save image', click: () => wc.downloadURL(p.srcURL) }, { type: 'separator' }] : []),
    ...(p.isEditable ? [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }] : p.selectionText ? [{ role: 'copy' }, { type: 'separator' }] : []),
    { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: 'Reload', click: () => wc.reload() },
    { type: 'separator' }, { label: 'Print…', click: () => wc.print({ printBackground: true }) }, { label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) },
  ]).popup()
}

// ---- shortcuts ----
const RUN = {
  newTab: () => openCmd('new'), editAddress: () => openCmd('edit'), closeTab: () => active && closeTab(active), reload: () => cur()?.view?.webContents.reload(),
  find: () => openFind(), zoomIn: () => zoom(1), zoomOut: () => zoom(-1), zoomReset: () => zoom(0), toggleSidebar: () => toggleSidebar(), splitView: () => toggleSplit(),
  library: () => openPanel('downloads'), history: () => openPanel('history'), settings: () => openPanel('settings'),
  print: () => cur()?.view?.webContents.print({ printBackground: true }), devtools: () => toggleDevtools(),
}
function shortcut(e, i) {
  if (i.type !== 'keyDown' || recording) return
  const c = keys.combo(i), a = c && keys.actionFor(keys.resolve(settings.shortcuts), c)
  if (a) { e.preventDefault(); RUN[a]() }
}
function toggleDevtools() { const wc = cur()?.view?.webContents; if (wc) wc.isDevToolsOpened() ? wc.closeDevTools() : wc.openDevTools({ mode: 'detach' }) }
function zoom(dir) { // step through Chromium's zoom levels; 0 resets
  const wc = cur()?.view?.webContents; if (!wc) return
  const z = wc.getZoomFactor(), i = ZOOMS.reduce((b, v, k) => Math.abs(v - z) < Math.abs(ZOOMS[b] - z) ? k : b, 0)
  wc.setZoomFactor(dir ? ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))] : 1); push()
}

// ---- overlays: command bar, panels, find ----
function openCmd(mode) {
  cmdOpen = true
  win.contentView.addChildView(cmd); cmd.setVisible(true); cmd.webContents.focus()
  cmd.webContents.send('open', { mode, value: mode === 'edit' ? cur()?.url || '' : '', left: content().x, right: GAP }) // center on the page area, not on the whole window
}
function closeCmd() { cmdOpen = false; cmd.setVisible(false); (peek?.view || cur()?.view)?.webContents.focus() }
function openPanel(section) {
  panelOpen = true; closeCmd()
  win.contentView.addChildView(panel); win.contentView.addChildView(cmd); panel.setVisible(true); panel.webContents.focus()
  panel.webContents.send('panel', { section }); push()
}
function closePanel() { panelOpen = false; recording = false; panel.setVisible(false); (peek?.view || cur()?.view)?.webContents.focus() }
function openFind() {
  if (!cur()?.view) return
  findOpen = true; find.setVisible(true); stack(); find.webContents.focus(); find.webContents.send('find:open', findText)
}
function closeFind() {
  if (!findOpen) return
  findOpen = false; find.setVisible(false); const wc = cur()?.view?.webContents
  wc?.stopFindInPage('clearSelection'); wc?.focus()
}

// ---- tabs ----
function visit(tab, u) { // history
  if (!/^https?:/.test(u)) return
  if (history[0]?.url === u) history[0].at = Date.now()
  else history.unshift({ url: u, title: tab.title, at: Date.now() })
  history.length = Math.min(history.length, 3000); store.save('history', history)
}
function routeFor(url) { // auto-routing: links to a routed site open in that site's space
  const h = hostOf(url); if (!h) return null
  return settings.routes.find(r => h === r.host || h.endsWith('.' + r.host))?.space ?? null
}
function newTab(input, sp) {
  const url = input ? resolve(input) : ''
  const tab = { id: nextId++, title: 'New tab', url, icon: null, loading: false, muted: false, asleep: false, error: null, pinned: false, fav: false, folder: null, space: sp ?? routeFor(url) ?? space, last: Date.now() }
  tabs.push(tab); makeView(tab); activate(tab.id)
  return tab
}
function activate(id) {
  const t = byId(id); if (!t) return
  const prev = cur()
  if (prev && prev.id !== id) { closeFind(); prev.last = Date.now(); if (!split?.includes(id)) autoPip(prev) }
  if (split && !split.includes(id)) split = null
  split?.forEach(x => { const s = byId(x); if (s.asleep) makeView(s) })
  if (t.asleep) makeView(t)
  active = id; if (!t.fav) space = t.space
  t.last = Date.now(); exitPip(t)
  refresh()
}
function removeTab(t) {
  tabs.splice(tabs.indexOf(t), 1)
  if (t.view) { win.contentView.removeChildView(t.view); t.view.webContents.close() }
  if (split?.includes(t.id)) split = null
  if (mediaTab === t.id) mediaTab = null
  if (pwPending?.tab === t.id) pwPending = null
}
function closeTab(id) {
  const t = byId(id); if (!t) return
  removeTab(t)
  if (active !== id) { refresh(); return }
  const sp = t.fav ? space : t.space, same = tabs.filter(x => x.space === sp && !x.fav)
  if (same.length) activate((same.find(x => x.id > id) || same.at(-1)).id)
  else newTab(null, sp)
}
function switchSpace(i) {
  space = i
  const mine = tabs.filter(t => t.space === i && !t.fav)
  mine.length ? activate((mine.find(t => !t.asleep) || mine[0]).id) : newTab(null, i)
}
function sleep(id) { // hibernate: free the page, keep the tab in the list
  const t = byId(id); if (!t?.view || isShown(id)) return
  win.contentView.removeChildView(t.view); t.view.webContents.close(); t.view = null; t.asleep = true; t.loading = false; t.playing = false
  if (mediaTab === id) mediaTab = null
  push()
}
function go(input) {
  const t = cur(); if (!t) return
  t.error = null; t.url = resolve(input)
  t.view ? t.view.webContents.loadURL(t.url) : makeView(t)
  push()
}
function retarget(t, sp) { // move a tab to another space: pages must be rebuilt in that space's profile
  if (t.space === sp) return
  t.space = sp
  if (t.view) { win.contentView.removeChildView(t.view); t.view.webContents.close(); makeView(t); t.view.setVisible(isShown(t.id)) }
}
function place(id, zone, fid, idx = 1e9) { // drag & drop: put a tab in a zone (fav | pinned | folder | list) at an index
  const t = byId(id); if (!t) return
  tabs.splice(tabs.indexOf(t), 1)
  t.fav = zone === 'fav'; t.pinned = zone === 'pinned'; t.folder = zone === 'folder' ? fid : null
  if (zone === 'folder') { const f = folders.find(x => x.id === fid); if (f) f.open = true; else t.folder = null }
  const mates = tabs.filter(x => zoneOf(x) === zoneOf(t) && (t.fav || x.space === t.space)), ref = mates[idx]
  tabs.splice(ref ? tabs.indexOf(ref) : mates.length ? tabs.indexOf(mates.at(-1)) + 1 : tabs.length, 0, t)
  push()
}
function toFavOrBack(t, zone, fid, idx) { // leaving favorites (shared by every space) adopts the space being viewed
  if (t.fav && zone !== 'fav') retarget(t, space)
  place(t.id, zone, fid, idx)
}
function newFolder() { const f = { id: nextId++, name: 'New folder', open: true, space }; folders.push(f); push(); return f.id }
function delFolder(fid) {
  tabs.forEach(t => { if (t.folder === fid) { t.folder = null; t.pinned = true } })
  folders = folders.filter(f => f.id !== fid); push()
}
const splitWith = (a, b) => { split = [a, b]; active = b; refresh() }
function toggleSplit() {
  if (split) { split = null; refresh(); return }
  const a = active; if (!a) return
  splitWith(a, newTab().id)
}
function openSplit(id) {
  if (!byId(id) || id === active) return
  split = [active, id]; activate(id)
}

// ---- auto-archive of unused tabs ----
function archiveTab(t) {
  if (t.url) { archive.unshift({ title: t.title, url: t.url, icon: t.icon, at: Date.now(), space: t.space }); archive.length = Math.min(archive.length, 500) }
  removeTab(t)
}
function sweep(now = Date.now()) {
  const h = settings.archiveHours; if (!h) return
  for (const t of [...tabs]) if (!t.fav && !t.pinned && !t.folder && !isShown(t.id) && !t.playing && now - t.last > h * 3600e3) archiveTab(t)
  push()
}

// ---- picture-in-picture ----
function autoPip(t) {
  if (!settings.autoPip || !t?.view) return
  t.view.webContents.executeJavaScript(PIP_ON, true).then(ok => { t.pip = ok; if (ok && isShown(t.id)) exitPip(t) }).catch(() => {})
}
function exitPip(t) { if (t?.pip && t.view) { t.pip = false; t.view.webContents.executeJavaScript(PIP_OFF, true).catch(() => {}) } }

// ---- sidebar ----
function toggleSidebar() { sidebar = !sidebar; floating = false; ui.setVisible(sidebar); edge.setVisible(!sidebar); layout(); stack(); push() }
function reveal(on) { // hovering the left edge slides the collapsed sidebar over the page
  if (sidebar || floating === on) return
  floating = on; ui.setVisible(on); edge.setVisible(!on); layout(); stack()
}

// ---- peek ----
function peekRect() {
  const c = content(), w = Math.min(1100, Math.round(c.w * .8)), h = Math.round(c.h * .9)
  return { x: c.x + Math.round((c.w - w) / 2), y: c.y + Math.round((c.h - h) / 2), w, h }
}
function peekSend() {
  if (!peek) return
  const wc = peek.view.webContents
  peekUi.webContents.send('peek', { title: wc.getTitle(), url: wc.getURL(), loading: wc.isLoading(), rect: peekRect(), bar: PEEKBAR })
}
function openPeek(url) {
  closePeek()
  const view = new WebContentsView({ webPreferences: { partition: SPACES[cur()?.space ?? space].partition, sandbox: true, contextIsolation: true, preload: TABPRELOAD } })
  const wc = view.webContents
  view.setBorderRadius(12)
  peek = { view }
  wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' } })
  for (const e of ['page-title-updated', 'did-start-loading', 'did-stop-loading', 'did-navigate']) wc.on(e, peekSend)
  wc.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'Escape') { e.preventDefault(); closePeek() } else shortcut(e, i) })
  wc.on('context-menu', (_, p) => pageMenu(wc, p))
  peekUi.setVisible(true); win.contentView.addChildView(view); stack(); layout()
  wc.loadURL(resolve(url)); wc.focus(); peekSend()
}
function closePeek() {
  if (!peek) return
  win.contentView.removeChildView(peek.view); peek.view.webContents.close(); peek = null
  peekUi.setVisible(false); peekUi.webContents.send('peek', null); cur()?.view?.webContents.focus()
}

// ---- little window: links from other apps ----
function openExternal(url) {
  if (!settings.littleExternal) { newTab(url); win.show(); win.focus(); return }
  if (little) { little.view.webContents.loadURL(url); little.win.focus(); return }
  const lw = new BaseWindow({ width: 460, height: 720, title: 'Heliarc', icon: ICON, backgroundColor: '#2a2a33' })
  const bar = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } })
  const view = new WebContentsView({ webPreferences: { partition: SPACES[0].partition, sandbox: true, contextIsolation: true, preload: TABPRELOAD } })
  const wc = view.webContents
  little = { win: lw, view, bar }
  lw.contentView.addChildView(view); lw.contentView.addChildView(bar)
  const fit = () => { const { width, height } = lw.getContentBounds(); bar.setBounds({ x: 0, y: 0, width, height: LITTLEBAR }); view.setBounds({ x: 0, y: LITTLEBAR, width, height: height - LITTLEBAR }) }
  const send = () => !bar.webContents.isDestroyed() && bar.webContents.send('little', { title: wc.getTitle(), url: wc.getURL(), loading: wc.isLoading() })
  fit(); lw.on('resize', fit)
  wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' } })
  for (const e of ['page-title-updated', 'did-start-loading', 'did-stop-loading', 'did-navigate']) wc.on(e, send)
  wc.on('context-menu', (_, p) => pageMenu(wc, p))
  bar.webContents.loadFile('ui/little.html'); bar.webContents.on('did-finish-load', send)
  wc.loadURL(resolve(url))
  lw.on('closed', () => { little = null; for (const v of [view, bar]) if (!v.webContents.isDestroyed()) v.webContents.close() })
}
const moveLittle = () => { if (!little) return; const u = little.view.webContents.getURL(); little.win.close(); newTab(u); win.show(); win.focus() }

// ---- downloads ----
function onDownload(_, item) {
  const dir = app.getPath('downloads'), name = path.basename(item.getFilename()) || 'download', ext = path.extname(name), base = path.basename(name, ext)
  let p = path.join(dir, name), n = 1
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`)
  item.setSavePath(p)
  const d = { id: nextId++, name: path.basename(p), path: p, url: item.getURL(), mime: item.getMimeType(), state: 'progressing', received: 0, total: item.getTotalBytes(), at: Date.now() }
  downloads.unshift(d); dls.set(d.id, item)
  item.on('updated', (_, st) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.state = item.isPaused() ? 'paused' : st === 'interrupted' ? 'interrupted' : 'progressing'; pushSoon() })
  item.once('done', (_, st) => {
    d.state = st; d.received = item.getReceivedBytes(); d.at = Date.now(); dls.delete(d.id)
    store.save('downloads', downloads.slice(0, 200)); push(); setTimeout(push, 8000)
  })
  push()
}

// ---- passwords (encrypted with the OS keychain via safeStorage) ----
const decrypt = v => { try { return safeStorage.decryptString(Buffer.from(v, 'base64')) } catch { return '' } }
function senderOrigin(e) { // only real web origins: file:, data: and about:blank pages have the opaque origin "null" and must never share logins
  try { const u = new URL(e.senderFrame.url); return /^https?:$/.test(u.protocol) ? u.origin : null } catch { return null }
}
function savePw(p) {
  const o = vault.find(v => v.origin === p.origin && v.user === p.user), enc = safeStorage.encryptString(p.pass).toString('base64')
  o ? o.pass = enc : vault.push({ id: nextId++, origin: p.origin, user: p.user, pass: enc })
  store.save('vault', vault)
}

// ---- spaces / privacy ----
const spaceSessions = () => SPACES.map(s => session.fromPartition(s.partition))
function setupSession(ses) {
  if (configured.has(ses)) return; configured.add(ses)
  ses.webRequest.onBeforeSendHeaders((d, cb) => { // Global Privacy Control + Do Not Track
    d.requestHeaders['Sec-GPC'] = '1'; d.requestHeaders['DNT'] = '1'; cb({ requestHeaders: d.requestHeaders })
  })
  ses.setPermissionRequestHandler((_, __, cb) => cb(false))
  ses.on('will-download', onDownload)
}
async function setupPrivacy() {
  spaceSessions().forEach(setupSession)
  try {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
    blocker.on('request-blocked', () => { blocked++; pushSoon() })
    for (const ses of configured) { // the blocker's cosmetic-filter IPC handlers are global: re-register them for each space's session
      for (const ch of ['inject-cosmetic-filters', 'is-mutation-observer-enabled']) ipcMain.removeHandler('@ghostery/adblocker/' + ch)
      blocker.enableBlockingInSession(ses)
    }
    blockerState = 'on'
  } catch (e) { console.warn('ad blocker:', e.message); blockerState = 'error' }
  push()
}

// ---- context menu on a sidebar tab ----
function tabMenu(id) {
  const t = byId(id); if (!t) return
  const h = hostOf(t.url), here = folders.filter(f => f.space === t.space)
  Menu.buildFromTemplate([
    { label: t.pinned ? 'Unpin tab' : 'Pin tab', click: () => toFavOrBack(t, t.pinned ? 'list' : 'pinned') },
    { label: t.fav ? 'Remove from favorites' : 'Add to favorites', click: () => toFavOrBack(t, t.fav ? 'list' : 'fav') },
    { label: 'Move to folder', enabled: !t.fav, submenu: [...here.map(f => ({ label: f.name, click: () => place(id, 'folder', f.id) })), { label: 'New folder', click: () => place(id, 'folder', newFolder()) }] },
    { label: 'Open in split view', enabled: id !== active, click: () => openSplit(id) },
    { type: 'separator' },
    { label: h ? `Always open ${h} in…` : 'Always open site in…', enabled: !!h, submenu: SPACES.map((s, i) => ({ label: s.name, click: () => setRoute(h, i) })) },
    { label: t.muted ? 'Unmute' : 'Mute', click: () => mute(id) },
    { label: 'Reload', enabled: !!t.view, click: () => t.view.webContents.reload() },
    { label: 'Hibernate', enabled: !!t.view && !isShown(id), click: () => sleep(id) },
    { type: 'separator' }, { label: 'Close tab', click: () => closeTab(id) },
  ]).popup()
}
const mute = id => { const t = byId(id); if (t) { t.muted = !t.muted; t.view?.webContents.setAudioMuted(t.muted); push() } }
function setRoute(host, sp) { settings.routes = [...settings.routes.filter(r => r.host !== host), { host, space: sp }]; push() }

// ---- app lifecycle ----
const urlArg = argv => argv.find(a => /^https?:\/\//i.test(a))
let ready
const whenReady = new Promise(r => { ready = r })
app.setName('Heliarc')
const gotLock = TEST || app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', (_, argv) => whenReady.then(() => { const u = urlArg(argv); u ? openExternal(u) : (win.show(), win.focus()) }))
app.on('open-url', (e, u) => { e.preventDefault(); whenReady.then(() => openExternal(u)) })
app.on('before-quit', store.flushAll)

app.whenReady().then(async () => {
  if (!gotLock) return // another instance is running: it handles this launch
  if (process.platform === 'darwin') app.dock?.setIcon(ICON)
  const saved = store.load('session', {})
  settings = { ...DEFAULTS, ...saved.settings }; history = store.load('history', []); vault = store.load('vault', []); profile = store.load('profile', {})
  downloads = store.load('downloads', []).map(d => d.state === 'progressing' || d.state === 'paused' ? { ...d, state: 'interrupted' } : d)
  win = new BaseWindow({ width: 1280, height: 820, title: 'Heliarc', icon: ICON, backgroundColor: '#2a2a33', ...(process.platform === 'darwin' && { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 16 } }) })
  const prefs = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  const overlay = (file, visible = false) => {
    const v = new WebContentsView({ webPreferences: prefs })
    v.setBackgroundColor('#00000000'); v.setVisible(visible); win.contentView.addChildView(v)
    v.webContents.loadFile('ui/' + file); v.webContents.on('before-input-event', shortcut)
    if (TEST) v.webContents.on('console-message', d => console.warn(`[${file}]`, d.level, d.message, d.sourceId?.split('/').pop() + ':' + d.lineNumber))
    return v
  }
  ui = new WebContentsView({ webPreferences: prefs }); win.contentView.addChildView(ui); ui.webContents.loadFile('ui/arc.html'); ui.webContents.on('before-input-event', shortcut)
  peekUi = overlay('peek.html'); edge = overlay('edge.html'); find = overlay('find.html'); panel = overlay('panel.html'); cmd = overlay('cmdbar.html')
  win.on('resize', layout)
  win.on('closed', () => app.quit())
  setupPrivacy()

  const h = (n, f) => ipcMain.handle(n, (_, ...a) => f(...a))
  h('new', () => openCmd('new')); h('edit', () => openCmd('edit')); h('closeCmd', closeCmd)
  h('activate', activate); h('close', closeTab); h('sleep', sleep); h('space', switchSpace); h('mute', mute)
  h('go', input => { closeCmd(); go(input) }); h('open', input => { closeCmd(); newTab(input) })
  h('pin', id => { const t = byId(id); if (t) toFavOrBack(t, t.pinned ? 'list' : 'pinned') })
  h('back', () => cur()?.view?.webContents.navigationHistory.goBack())
  h('fwd', () => cur()?.view?.webContents.navigationHistory.goForward())
  h('reload', () => cur()?.view?.webContents.reload())
  h('ready', push)
  h('ctx', tabMenu)
  h('move', (id, zone, fid, idx) => { const t = byId(id); t && toFavOrBack(t, zone, fid, idx) })
  h('newFolder', newFolder); h('delFolder', delFolder)
  h('renameFolder', (fid, name) => { const f = folders.find(x => x.id === fid); if (f && name.trim()) { f.name = name.trim(); push() } })
  h('toggleFolder', fid => { const f = folders.find(x => x.id === fid); if (f) { f.open = !f.open; push() } })
  h('toggleSidebar', toggleSidebar); h('reveal', () => reveal(true)); h('unreveal', () => reveal(false))
  h('split', toggleSplit); h('zoomReset', () => zoom(0))
  h('openPanel', openPanel); h('closePanel', closePanel); h('recording', v => { recording = v })
  h('findText', (text, forward = true, next = false) => {
    findText = text; const wc = cur()?.view?.webContents; if (!wc) return
    // never pass findNext:false: Electron then drops the result event
    text ? wc.findInPage(text, next ? { forward, findNext: true } : { forward }) : (wc.stopFindInPage('clearSelection'), find.webContents.send('found', { active: 0, total: 0 }))
  })
  h('findClose', closeFind); h('comboOf', keys.combo)
  h('peekToTab', () => { if (!peek) return; const u = peek.view.webContents.getURL(); closePeek(); newTab(u) }); h('peekClose', closePeek)
  h('littleToMain', moveLittle); h('littleClose', () => little?.win.close())
  h('mediaToggle', () => byId(mediaTab)?.view?.webContents.executeJavaScript(MEDIA_TOGGLE, true).then(p => { byId(mediaTab).playing = p; push() }).catch(() => {}))
  h('mediaGo', () => mediaTab && activate(mediaTab))
  // library
  h('restoreArchive', i => { const a = archive.splice(i, 1)[0]; if (a) newTab(a.url, a.space); push() })
  h('clearArchive', () => { archive = []; push() })
  h('openFile', id => { const d = downloads.find(x => x.id === id); return d && shell.openPath(d.path) })
  h('showFile', id => { const d = downloads.find(x => x.id === id); d && shell.showItemInFolder(d.path) })
  h('cancelDownload', id => { dls.get(id)?.cancel() })
  h('delDownload', id => { downloads = downloads.filter(d => d.id !== id); store.save('downloads', downloads); push() })
  h('clearDownloads', () => { downloads = downloads.filter(d => d.state === 'progressing'); store.save('downloads', downloads); push() })
  // history, passwords, profile
  h('history', q => history.filter(x => !q || (x.title + ' ' + x.url).toLowerCase().includes(q.toLowerCase())).slice(0, 300))
  h('delHistory', at => { history = history.filter(x => x.at !== at); store.save('history', history) })
  h('clearHistory', () => { history = []; store.save('history', history) })
  h('passwords', () => vault.map(({ id, origin, user }) => ({ id, origin, user })))
  h('delPassword', id => { vault = vault.filter(v => v.id !== id); store.save('vault', vault) })
  h('profile', () => profile)
  h('setProfile', p => { profile = { ...p, name: [p.first, p.last].filter(Boolean).join(' ') }; store.save('profile', profile) })
  h('pwSave', () => { if (pwPending) { savePw(pwPending); pwPending = null; push() } })
  h('pwNever', () => { if (pwPending) { settings.pwNever.push(pwPending.origin); pwPending = null; push() } })
  h('pwDismiss', () => { pwPending = null; push() })
  h('extensions', () => ext.list(spaceSessions()[0]))
  h('installExtension', async input => { try { return { ok: true, ...await ext.installFromStore(input, spaceSessions()) } } catch (e) { return { error: e.message } } })
  h('removeExtension', id => ext.remove(id, spaceSessions()))
  // settings
  h('setSetting', (k, v) => { if (['archiveHours', 'autoPip', 'littleExternal'].includes(k)) { settings[k] = v; push() } })
  h('addRoute', (host, sp) => { host = hostOf('https://' + host.trim().replace(/^https?:\/\//, '')); if (host && SPACES[sp]) setRoute(host, sp) })
  h('delRoute', host => { settings.routes = settings.routes.filter(r => r.host !== host); push() })
  h('setShortcut', (action, c) => {
    if (!keys.ACTIONS[action]) return { error: 'Unknown action' }
    if (c === null) { delete settings.shortcuts[action]; push(); return { ok: true } }
    if (!keys.valid(c)) return { error: `Use ${process.platform === 'darwin' ? '⌘' : 'Ctrl'} or Alt with a key` }
    if (c === 'F12' && action !== 'devtools') return { error: 'F12 is reserved for developer tools' }
    const clash = Object.entries(keys.resolve(settings.shortcuts)).find(([a, k]) => k === c && a !== action)
    if (clash) return { error: `Already used by “${keys.ACTIONS[clash[0]][0]}”` }
    settings.shortcuts[action] = c; push(); return { ok: true }
  })
  h('defaultBrowser', () => {
    for (const p of ['http', 'https']) process.defaultApp ? app.setAsDefaultProtocolClient(p, process.execPath, [path.resolve(__dirname)]) : app.setAsDefaultProtocolClient(p)
    if (process.platform === 'win32') shell.openExternal('ms-settings:defaultapps')
    return app.isDefaultProtocolClient('http')
  })
  ipcMain.on('pw:captured', (e, { user, pass }) => {
    const t = tabOf(e.sender), origin = senderOrigin(e)
    if (!t || !origin || !pass || !safeStorage.isEncryptionAvailable() || settings.pwNever.includes(origin)) return
    const old = vault.find(v => v.origin === origin && v.user === user)
    if (old && decrypt(old.pass) === pass) return
    pwPending = { tab: t.id, origin, user, pass, update: !!old }; push()
    const mine = pwPending; setTimeout(() => { if (pwPending === mine) { pwPending = null; push() } }, 90e3)
  })
  ipcMain.handle('pw:get', e => { const o = senderOrigin(e); return o && tabOf(e.sender) ? vault.filter(v => v.origin === o).map(v => ({ user: v.user, pass: decrypt(v.pass) })) : [] })
  ipcMain.handle('profile:get', e => tabOf(e.sender) ? profile : null)

  await ext.loadInstalled(spaceSessions()) // before any page loads, so content scripts reach restored tabs
  // restore the previous session; only the active tab is loaded, the others wake up when selected
  nextId = Math.max(1, ...(saved.tabs || []).map(t => t.id + 1), ...(saved.folders || []).map(f => f.id + 1), ...downloads.map(d => d.id + 1), ...vault.map(v => v.id + 1))
  folders = saved.folders || []; archive = saved.archive || []; sidebar = saved.sidebar !== false; space = SPACES[saved.space] ? saved.space : 0
  tabs = (saved.tabs || []).filter(t => SPACES[t.space]).map(t => ({ title: 'New tab', url: '', icon: null, muted: false, pinned: false, fav: false, folder: null, last: Date.now(), ...t, view: null, loading: false, asleep: true, error: null }))
  ui.setVisible(sidebar); edge.setVisible(!sidebar)
  tabs.length ? activate(byId(saved.active)?.id ?? tabs[0].id) : newTab()
  layout(); stack(); sweep(); setInterval(sweep, 5 * 60e3).unref()
  ready()
  const first = urlArg(process.argv.slice(1)); if (first) openExternal(first)

  if (process.argv.includes('--motioncheck')) require('./scripts/motion-check')({ newTab, switchSpace, openCmd, closeCmd, ui: () => ui, cmd: () => cmd })
  if (process.argv.some(x => x === '--selftest' || x === '--selftest-local')) require('./selftest')({
    tabs: () => tabs, newTab, closeTab, sleep, activate, go, resolve, cur, switchSpace, openCmd, closeCmd, cmdOpen: () => cmdOpen,
    pin: id => { const t = byId(id); t.pinned = !t.pinned; push() }, stats: () => ({ blocked, blockerState }), win: () => win, ui: () => ui, cmd: () => cmd,
    // library of hooks for the feature tests
    S: { place, newFolder, delFolder, openSplit, toggleSplit, splitState: () => split, folders: () => folders, active: () => active, sweep, archive: () => archive, settings: () => settings,
      zoom, openFind, closeFind, find: () => find, findOpen: () => findOpen, openPanel, closePanel, panel: () => panel, openPeek, closePeek, peek: () => peek, peekUi: () => peekUi,
      openExternal, little: () => little, toggleSidebar, reveal, sidebar: () => sidebar, floating: () => floating, edge: () => edge, history: () => history, downloads: () => downloads,
      ext, spaceSessions, vault: () => vault, pending: () => pwPending, savePw, tabMenu, mediaTab: () => mediaTab, byId, push, setRoute, routeFor, toggleDevtools, keys, shortcut, store, space: () => space, content, SPACES },
  })
})
app.on('window-all-closed', () => app.quit())
