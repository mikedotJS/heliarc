const { app, BaseWindow, WebContentsView, ipcMain, session } = require('electron')
const path = require('path')
const { ElectronBlocker } = require('@ghostery/adblocker-electron')
const { resolve } = require('./bangs')

const SIDEBAR = 262, GAP = 8
const ICON = path.join(__dirname, 'assets', 'icon.png')
const NEWTAB = 'file://' + path.join(__dirname, 'ui', 'newtab.html').replace(/\\/g, '/')
const SPACES = [
  { name: 'Home', icon: 'house', c1: '#5b4bff', c2: '#c04bff' },
  { name: 'Work', icon: 'briefcase', c1: '#0aa6a6', c2: '#2b6fff' },
  { name: 'Fun', icon: 'gamepad-2', c1: '#ff7a3d', c2: '#ff3d77' },
]
let win, ui, cmd, tabs = [], active = null, space = 0, nextId = 1, blocked = 0, blockerState = 'loading', cmdOpen = false

const cur = () => tabs.find(t => t.id === active)
const push = () => {
  if (!ui) return
  const nav = cur()?.view?.webContents.navigationHistory
  const s = {
    active, space, spaces: SPACES, blocked, blockerState, canBack: nav?.canGoBack() ?? false, canFwd: nav?.canGoForward() ?? false,
    tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, icon: t.icon, loading: t.loading, muted: t.muted, asleep: t.asleep, error: t.error, pinned: t.pinned, space: t.space })),
  }
  for (const v of [ui, cmd]) if (!v.webContents.isDestroyed()) v.webContents.send('state', s)
}

function layout() {
  const { width, height } = win.getContentBounds()
  ui.setBounds({ x: 0, y: 0, width, height })
  cmd.setBounds({ x: 0, y: 0, width, height })
  tabs.forEach(t => t.view?.setBounds({ x: SIDEBAR, y: GAP, width: width - SIDEBAR - GAP, height: height - GAP * 2 }))
}

function makeView(tab) {
  const view = new WebContentsView({ webPreferences: { partition: 'persist:main', sandbox: true, contextIsolation: true } })
  const wc = view.webContents
  view.setBorderRadius(12)
  tab.view = view; tab.asleep = false
  wc.setWindowOpenHandler(({ url }) => { newTab(url); return { action: 'deny' } })
  wc.on('page-title-updated', (_, t) => { tab.title = t; push() })
  wc.on('page-favicon-updated', (_, icons) => { tab.icon = icons[0]; push() })
  wc.on('did-start-loading', () => { tab.loading = true; tab.error = null; push() })
  wc.on('did-stop-loading', () => { tab.loading = false; push() })
  wc.on('did-navigate', (_, u) => { tab.url = u.startsWith('file:') ? '' : u; push() })
  wc.on('did-navigate-in-page', (_, u) => { tab.url = u; push() })
  wc.on('did-fail-load', (_, code, desc, url, isMain) => {
    if (isMain && code !== -3) { tab.error = `${desc} — ${url}`; tab.loading = false; push() }
  })
  wc.on('before-input-event', (e, i) => shortcut(e, i))
  wc.setAudioMuted(tab.muted)
  win.contentView.addChildView(view)
  win.contentView.addChildView(cmd) // keep the command bar on top
  wc.loadURL(tab.url || NEWTAB)
  layout()
}

function shortcut(e, i) {
  if (i.type !== 'keyDown' || !(process.platform === 'darwin' ? i.meta : i.control)) return
  const k = i.key.toLowerCase()
  if (k === 't') { e.preventDefault(); openCmd('new') }
  else if (k === 'l') { e.preventDefault(); openCmd('edit') }
  else if (k === 'w') { e.preventDefault(); if (active) closeTab(active) }
}
function openCmd(mode) {
  cmdOpen = true
  win.contentView.addChildView(cmd); cmd.setVisible(true); cmd.webContents.focus()
  cmd.webContents.send('open', { mode, value: mode === 'edit' ? cur()?.url || '' : '' })
}
function closeCmd() { cmdOpen = false; cmd.setVisible(false); cur()?.view?.webContents.focus() }

function newTab(input, sp = space) {
  const tab = { id: nextId++, title: 'New tab', url: input ? resolve(input) : '', icon: null, loading: false, muted: false, asleep: false, error: null, pinned: false, space: sp }
  tabs.push(tab); makeView(tab); activate(tab.id)
  return tab
}
function activate(id) {
  const t = tabs.find(x => x.id === id); if (!t) return
  if (t.asleep) makeView(t)
  active = id; space = t.space
  tabs.forEach(x => x.view?.setVisible(x.id === id))
  layout(); push()
}
function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return
  const [t] = tabs.splice(i, 1)
  if (t.view) { win.contentView.removeChildView(t.view); t.view.webContents.close() }
  if (active !== id) { push(); return }
  const same = tabs.filter(x => x.space === t.space)
  if (same.length) activate((same.find(x => x.id > id) || same.at(-1)).id)
  else newTab(null, t.space)
}
function switchSpace(i) {
  space = i
  const mine = tabs.filter(t => t.space === i)
  mine.length ? activate((mine.find(t => !t.asleep) || mine[0]).id) : newTab(null, i)
}
function sleep(id) { // hibernate: free the page, keep the tab in the list
  const t = tabs.find(x => x.id === id); if (!t?.view || id === active) return
  win.contentView.removeChildView(t.view); t.view.webContents.close(); t.view = null; t.asleep = true; t.loading = false; push()
}
function go(input) {
  const t = cur(); if (!t) return
  t.error = null; t.url = resolve(input)
  t.view ? t.view.webContents.loadURL(t.url) : makeView(t)
  push()
}

async function setupPrivacy(ses) {
  ses.webRequest.onBeforeSendHeaders((d, cb) => { // Global Privacy Control + Do Not Track
    d.requestHeaders['Sec-GPC'] = '1'; d.requestHeaders['DNT'] = '1'; cb({ requestHeaders: d.requestHeaders })
  })
  ses.setPermissionRequestHandler((_, __, cb) => cb(false))
  try {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
    blocker.enableBlockingInSession(ses)
    blocker.on('request-blocked', () => { blocked++; push() })
    blockerState = 'on'
  } catch { blockerState = 'error' }
  push()
}

app.setName('Heliarc')
app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.setIcon(ICON)
  win = new BaseWindow({ width: 1280, height: 820, title: 'Heliarc', icon: ICON, backgroundColor: '#2a2a33', ...(process.platform === 'darwin' && { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 16 } }) })
  const prefs = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  ui = new WebContentsView({ webPreferences: prefs })
  cmd = new WebContentsView({ webPreferences: prefs })
  cmd.setBackgroundColor('#00000000'); cmd.setVisible(false)
  win.contentView.addChildView(ui); win.contentView.addChildView(cmd)
  ui.webContents.loadFile('ui/arc.html'); cmd.webContents.loadFile('ui/cmdbar.html')
  for (const v of [ui, cmd]) v.webContents.on('before-input-event', (e, i) => shortcut(e, i))
  win.on('resized', layout)
  setupPrivacy(session.fromPartition('persist:main'))

  const h = (n, f) => ipcMain.handle(n, (_, ...a) => f(...a))
  h('new', () => openCmd('new')); h('edit', () => openCmd('edit')); h('closeCmd', closeCmd)
  h('activate', activate); h('close', closeTab); h('sleep', sleep); h('space', switchSpace)
  h('go', input => { closeCmd(); go(input) }); h('open', input => { closeCmd(); newTab(input) })
  h('pin', id => { const t = tabs.find(x => x.id === id); if (t) { t.pinned = !t.pinned; push() } })
  h('back', () => cur()?.view?.webContents.navigationHistory.goBack())
  h('fwd', () => cur()?.view?.webContents.navigationHistory.goForward())
  h('reload', () => cur()?.view?.webContents.reload())
  h('mute', id => { const t = tabs.find(x => x.id === id); if (t) { t.muted = !t.muted; t.view?.webContents.setAudioMuted(t.muted); push() } })
  h('ready', push)

  newTab(); layout()
  if (process.argv.includes('--motioncheck')) require('./scripts/motion-check')({ newTab, switchSpace, openCmd, closeCmd, ui: () => ui, cmd: () => cmd })
  if (process.argv.includes('--selftest')) require('./selftest')({ tabs: () => tabs, newTab, closeTab, sleep, activate, go, resolve, cur, switchSpace, openCmd, closeCmd, cmdOpen: () => cmdOpen, pin: id => { const t = tabs.find(x => x.id === id); t.pinned = !t.pinned; push() }, stats: () => ({ blocked, blockerState }), win: () => win, ui: () => ui, cmd: () => cmd })
})
app.on('window-all-closed', () => app.quit())
