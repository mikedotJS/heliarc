// Feature tests that need no internet: they drive the real browser against a local HTTP server.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await fn().catch(() => false)) return true; await sleep(100) } return false }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const VIDEO = `<title>Video</title><video id=v width=320 height=180></video><canvas id=c width=320 height=180></canvas><script>const c=document.getElementById('c'),g=c.getContext('2d');setInterval(()=>{g.fillStyle='hsl('+(Date.now()/10%360)+',80%,50%)';g.fillRect(0,0,320,180)},30);const v=document.getElementById('v');v.srcObject=c.captureStream(30);v.play()</script>`
const PAGES = {
  '/': '<title>Local home</title><h1>hello</h1><p>needle needle needle</p><a id=l href="/second">second</a>',
  '/second': '<title>Second page</title><p>second</p>',
  '/login': '<title>Login</title><form id=f method=post action=/done><input id=u name=user type=text><input id=p name=pass type=password><button type=button id=eye>Show</button><button>Go</button></form>',
  '/done': '<title>Done</title>ok',
  '/profile': '<title>Profile</title><form><input id=em autocomplete=email><input id=fn autocomplete=given-name><input id=ci autocomplete=address-level2></form>',
  '/video': VIDEO,
}
const shots = path.join(os.tmpdir(), 'heliarc-shots')

module.exports = async (a, ok) => {
  const S = a.S, ui = () => a.ui().webContents, panel = () => S.panel().webContents
  if (process.env.HELIARC_EXPECT_RESTORE) { // second launch on the profile left by a previous run (see README: testing session restore)
    await sleep(1500); const t = a.tabs()
    ok('previous tabs come back', t.length >= 3, 'tabs=' + t.length)
    ok('pinned tab comes back', t.some(x => x.pinned && /127\.0\.0\.1/.test(x.url))); ok('favorite comes back', t.some(x => x.fav)); ok('folder comes back', S.folders().length === 1)
    ok('only the active tab is loaded', t.filter(x => x.view).length === 1 && !!a.cur()?.view, 'loaded=' + t.filter(x => x.view).length)
    return
  }
  const js = (wc, code) => wc.executeJavaScript(code, true)
  const snap = async (v, n) => { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, n + '.png'), (await v.webContents.capturePage()).toPNG()) }
  const server = http.createServer((q, r) => {
    const u = q.url.split('?')[0]
    if (u === '/file.bin') { r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="data.bin"', 'Content-Length': 200000 }); return r.end(Buffer.alloc(200000, 7)) }
    if (u === '/pic.png') { r.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="pic.png"' }); return r.end(PNG) }
    if (u === '/cookie') { r.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'who=someone; Path=/' }); return r.end('<title>Cookie set</title>set') }
    if (u === '/whoami') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(`<title>Who</title><p id=c>${q.headers.cookie || 'none'}</p>`) }
    r.writeHead(PAGES[u] ? 200 : 404, { 'Content-Type': 'text/html' }); r.end(PAGES[u] || '<title>404</title>')
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const open = async (p, sp) => { const t = a.newTab(base + p, sp); await until(async () => t.view && t.title !== 'New tab' && !t.loading && t.url.startsWith(base)); return t }
  const reset = () => { a.switchSpace(0); S.folders().slice().forEach(f => S.delFolder(f.id)); for (const t of [...a.tabs()]) a.closeTab(t.id) }
  const uiN = sel => js(ui(), `document.querySelectorAll(${JSON.stringify(sel)}).length`)
  const section = async (name, fn) => { try { await fn() } catch (e) { ok(name + ' (exception)', false, e.stack.split('\n').slice(0, 3).join(' | ')) } }
  reset(); await sleep(500)

  await section('browser basics', async () => {
    const t = await open('/'); const wc = t.view.webContents
    ok('history records a visit', S.history()[0]?.url === base + '/', S.history()[0]?.url)
    S.openFind(); await until(async () => S.findOpen())
    await js(S.find().webContents, `(()=>{const q=document.querySelector('#q');q.value='needle';q.dispatchEvent(new Event('input'))})()`)
    ok('find in page counts matches', await until(async () => await js(S.find().webContents, `document.querySelector('#n').textContent`) === '1 / 3'), await js(S.find().webContents, `document.querySelector('#n').textContent`))
    await snap(S.find(), 'find')
    await js(S.find().webContents, `(()=>{const q=document.querySelector('#q');q.value='zzzz';q.dispatchEvent(new Event('input'))})()`)
    ok('find shows "No match"', await until(async () => await js(S.find().webContents, `document.querySelector('#n').textContent`) === 'No match'), await js(S.find().webContents, `document.querySelector('#n').textContent`))
    S.closeFind(); ok('find closes', !S.findOpen())
    S.zoom(1); ok('zoom in', Math.abs(wc.getZoomFactor() - 1.1) < .01, wc.getZoomFactor())
    await sleep(300); ok('zoom badge in sidebar', await js(ui(), `!document.querySelector('#zoom').hidden && document.querySelector('#zoom').textContent`) === '110%')
    S.zoom(0); ok('zoom reset', wc.getZoomFactor() === 1)
    S.toggleDevtools(); ok('devtools open', await until(async () => wc.isDevToolsOpened())); S.toggleDevtools(); ok('devtools close', await until(async () => !wc.isDevToolsOpened()))
    const pdf = await wc.printToPDF({}); ok('print engine produces a PDF', pdf.length > 1000 && pdf.subarray(0, 4).toString() === '%PDF', pdf.length)
    wc.downloadURL(base + '/file.bin')
    ok('download completes', await until(async () => S.downloads()[0]?.state === 'completed'), JSON.stringify(S.downloads()[0]))
    const d = S.downloads()[0]; ok('downloaded file is on disk', fs.existsSync(d.path) && fs.statSync(d.path).size === 200000, d.path)
    wc.downloadURL(base + '/pic.png'); await until(async () => S.downloads()[0]?.name === 'pic.png' && S.downloads()[0]?.state === 'completed')
    wc.downloadURL(base + '/pic.png'); await until(async () => S.downloads().length === 3 && S.downloads()[0].state === 'completed')
    ok('same name is not overwritten', S.downloads()[0].name === 'pic (1).png', S.downloads()[0].name)
    await sleep(300); ok('sidebar shows the finished download', await uiN('#dl .card') === 1)
    for (const sec of ['downloads', 'media', 'archive', 'history', 'passwords', 'settings']) {
      S.openPanel(sec); await sleep(700)
      const bad = await js(panel(), `!!document.querySelector('.err') || !document.querySelector('#body').innerHTML.trim()`)
      ok('panel section ' + sec + ' renders', !bad)
      if (sec === 'media') ok('library media lists downloaded pictures', await js(panel(), `document.querySelectorAll('.thumb').length`) === 2, await js(panel(), `document.querySelectorAll('.thumb').length`))
      if (sec === 'history') ok('history panel lists the visit', await js(panel(), `document.body.innerText.includes('Local home')`))
      if (sec === 'downloads' || sec === 'settings') await snap(S.panel(), 'panel-' + sec)
    }
    S.closePanel()
  })

  await section('passwords and autofill', async () => {
    ok('passwords can be encrypted here', require('electron').safeStorage.isEncryptionAvailable())
    const t = await open('/login'); const wc = t.view.webContents
    await js(wc, `document.getElementById('u').value='michael'; document.getElementById('p').value='s3cret!'; document.getElementById('f').requestSubmit()`)
    ok('login is detected', await until(async () => S.pending()?.user === 'michael'), JSON.stringify(S.pending()?.user))
    await sleep(300); await snap(a.ui(), 'pwbar')
    ok('sidebar offers to save', await js(ui(), `document.querySelector('#pwbar').classList.contains('show') && document.querySelector('#pwbar').innerText.includes('michael')`))
    await js(ui(), `document.querySelector('[data-pw=pwSave]').click()`)
    ok('password saved encrypted', await until(async () => S.vault().length === 1) && !JSON.stringify(S.vault()).includes('s3cret'), JSON.stringify(S.vault()).slice(0, 80))
    ok('offer disappears after saving', S.pending() === null)
    ok('Chrome Web Store pages offer "Add to Heliarc"', await js(ui(), `(() => { const t = state.tabs.find(t => t.id === state.active), u = t.url; t.url = 'https://chromewebstore.google.com/detail/x/abcdefghijklmnopabcdefghijklmnop'; render(); const r = document.querySelector('#extbar').innerText.includes('Add to Heliarc'); t.url = u; render(); return r && !document.querySelector('#extbar').classList.contains('show') })()`))
    await open('/login'); const t2 = a.cur(); await sleep(300)
    const val = (wc, ids) => js(wc, `${JSON.stringify(ids)}.map(i => document.getElementById(i).value).join('/')`)
    const click = async (wc, sel) => {
      const p = await js(wc, `(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`)
      wc.focus(); wc.sendInputEvent({ type: 'mouseMove', ...p }); wc.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 })
    }
    await js(t2.view.webContents, `document.getElementById('u').focus()`); await sleep(700)
    ok('a page script cannot trigger autofill', await val(t2.view.webContents, ['u', 'p']) === '/', await val(t2.view.webContents, ['u', 'p']))
    await click(t2.view.webContents, '#u')
    ok('saved login is filled when you click the field', await until(async () => await val(t2.view.webContents, ['u', 'p']) === 'michael/s3cret!'))
    await click(t2.view.webContents, '#eye'); await sleep(500)
    ok('"show password" button does not offer to save', S.pending() === null)
    // same login again: no new offer; changed password: offer an update
    await js(t2.view.webContents, `document.getElementById('p').value='another'; document.getElementById('f').requestSubmit()`)
    ok('changed password offers an update', await until(async () => S.pending()?.update === true))
    await js(ui(), `document.querySelector('[data-pw=pwDismiss]').click()`)
    await js(panel(), `api.call('setProfile', { first: 'Ada', last: 'Lovelace', email: 'ada@example.com', city: 'Paris' })`)
    const t3 = await open('/profile'); await click(t3.view.webContents, '#em')
    ok('profile fills address forms', await until(async () => await js(t3.view.webContents, `[...document.querySelectorAll('input')].map(i => i.value).join('|')`) === 'ada@example.com|Ada|Paris'), await js(t3.view.webContents, `[...document.querySelectorAll('input')].map(i => i.value).join('|')`))
  })

  await section('organizing tabs', async () => {
    reset(); await sleep(300)
    const t1 = await open('/'), t2 = await open('/second'), t3 = await open('/login')
    S.place(t1.id, 'fav'); S.place(t2.id, 'pinned'); await sleep(300)
    ok('favorites show at the top', await uiN('#pins .tile') === 1); ok('pinned show in their own list', await uiN('#pinned .tab') === 1)
    const fid = S.newFolder(); S.place(t3.id, 'folder', fid); await sleep(300)
    ok('folder holds the tab', t3.folder === fid && await uiN(`.folder[data-fid="${fid}"] .fb .tab`) === 1)
    await js(ui(), `document.querySelector('.fh .n').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await sleep(200)
    await js(ui(), `(() => { const i = document.querySelector('.fh input'); i.value = 'Research'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })) })()`); await sleep(300)
    ok('folder can be renamed', S.folders()[0].name === 'Research', S.folders()[0].name)
    await snap(a.ui(), 'sidebar-organized')
    const t4 = await open('/video'); await sleep(300)
    // drag the new tab into the folder with the mouse
    const r = async sel => js(ui(), `(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`)
    const m = (type, p, extra = {}) => ui().sendInputEvent({ type, x: p.x, y: p.y, button: 'left', clickCount: 1, ...extra })
    const drag = async (fromSel, toSel) => { // the layout shifts once a drag starts, so aim after it began
      const from = await r(fromSel)
      m('mouseMove', from); m('mouseDown', from); await sleep(100); m('mouseMove', { x: from.x + 6, y: from.y + 6 }, { modifiers: ['leftButtonDown'] }); await sleep(250)
      const to = await r(toSel)
      for (let i = 1; i <= 10; i++) { m('mouseMove', { x: from.x + 6 + (to.x - from.x - 6) * i / 10, y: from.y + 6 + (to.y - from.y - 6) * i / 10 }, { modifiers: ['leftButtonDown'] }); await sleep(40) }
      await sleep(150); m('mouseUp', to); await sleep(600)
    }
    await drag(`[data-id="${t4.id}"]`, `.fb[data-fid="${fid}"] .tab`)
    if (t4.folder !== fid) await drag(`[data-id="${t4.id}"]`, `.fb[data-fid="${fid}"] .tab`) // synthetic mouse timing can miss on a slow CI machine
    ok('drag & drop moves a tab into a folder', t4.folder === fid, `folder=${t4.folder} pinned=${t4.pinned} fav=${t4.fav}`)
    await drag(`[data-id="${t4.id}"]`, '#pins .tile')
    ok('drag & drop makes a favorite', t4.fav === true && t4.folder === null, `fav=${t4.fav} folder=${t4.folder}`)
    S.place(t4.id, 'list'); // favorites are shared by every space
    S.place(t1.id, 'fav'); a.switchSpace(1); await sleep(400)
    ok('favorites follow you to other spaces', await uiN('#pins .tile') === 1 && await uiN('#list .tab') === 1)
    a.switchSpace(0); await sleep(300)
    // split view
    a.activate(t3.id); S.openSplit(t2.id); await sleep(400)
    const b1 = t3.view.getBounds(), b2 = t2.view.getBounds()
    ok('split view shows two pages side by side', S.splitState()?.length === 2 && b1.width === b2.width && b2.x > b1.x + b1.width - 1 && t3.view.getVisible() && t2.view.getVisible(), JSON.stringify([b1, b2]))
    await snap(a.ui(), 'sidebar-split'); await snap(a.cur().view, 'split-page')
    S.toggleSplit(); await sleep(200); ok('split view exits', S.splitState() === null && t2.view.getBounds().width === t3.view.getBounds().width)
    const before = a.tabs().length; S.toggleSplit(); await sleep(400); ok('new split opens a blank partner tab', S.splitState()?.length === 2 && a.tabs().length === before + 1, 'tabs=' + a.tabs().length); S.toggleSplit()
    // auto-archive
    const old = await open('/second'); a.activate(t3.id); old.last = Date.now() - 13 * 3600e3; const n = S.archive().length
    S.sweep(); ok('tabs unused for 12h are archived', S.archive().length === n + 1 && !a.tabs().includes(old) && S.archive()[0].url === base + '/second')
    t2.last = 0; t1.last = 0; S.sweep(); ok('pinned tabs and favorites survive archiving', a.tabs().includes(t1) && a.tabs().includes(t2))
    S.openPanel('archive'); await sleep(600); ok('archive lists the tab', await js(panel(), `document.body.innerText.includes('Second page')`)); await snap(S.panel(), 'panel-archive')
    const count = a.tabs().length; await js(panel(), `document.querySelector('[data-a=restoreArchive]').click()`); await sleep(600)
    ok('archived tab restores', a.tabs().length === count + 1 && a.cur().url === base + '/second' && S.archive().length === n)
    S.closePanel()
  })

  await section('spaces, routing, peek, little', async () => {
    reset(); await sleep(300)
    const h = await open('/cookie'); const w = await open('/whoami', 1)
    ok('spaces have separate profiles', await js(w.view.webContents, `document.getElementById('c').textContent`) === 'none' && w.space === 1)
    const h2 = await open('/whoami', 0); ok('same space keeps its cookies', await js(h2.view.webContents, `document.getElementById('c').textContent`) === 'who=someone')
    a.switchSpace(0)
    S.setRoute('127.0.0.1', 2); const r = a.newTab(base + '/second'); await sleep(300)
    ok('links to a routed site open in its space', r.space === 2 && S.space() === 2, 'space=' + r.space); S.settings().routes = []; a.switchSpace(0)
    // peek
    const t = await open('/'); S.openPeek(base + '/second'); await until(async () => S.peek() && !S.peek().view.webContents.isLoading() && S.peek().view.webContents.getTitle() === 'Second page')
    ok('peek opens a floating page', !!S.peek() && S.peek().view.webContents.getTitle() === 'Second page')
    await sleep(500); await snap(S.peekUi(), 'peek-ui'); await snap(S.peek().view, 'peek-page')
    ok('peek is centered over the page', (() => { const b = S.peek().view.getBounds(), c = S.content(); return b.x > c.x && b.y > c.y && b.x + b.width < c.x + c.w })())
    const n = a.tabs().length; await js(S.peekUi().webContents, `document.querySelector('#tab').click()`); await sleep(700)
    ok('peek can be opened in a tab', S.peek() === null && a.tabs().length === n + 1 && a.cur().url === base + '/second')
    S.openPeek(base + '/'); await sleep(500); await js(S.peekUi().webContents, `document.querySelector('#x').click()`); await sleep(300); ok('peek closes', S.peek() === null)
    a.activate(t.id); await sleep(300)
    // shift+click on a link opens a peek
    const wc = t.view.webContents, pt = await js(wc, `(() => { const b = document.getElementById('l').getBoundingClientRect(); return { x: Math.round(b.x + 5), y: Math.round(b.y + b.height / 2) } })()`)
    wc.focus(); wc.sendInputEvent({ type: 'mouseMove', ...pt }); wc.sendInputEvent({ type: 'mouseDown', ...pt, button: 'left', clickCount: 1, modifiers: ['shift'] }); wc.sendInputEvent({ type: 'mouseUp', ...pt, button: 'left', clickCount: 1, modifiers: ['shift'] })
    ok('shift+click on a link opens a peek', await until(async () => !!S.peek()), 'peek=' + !!S.peek()); S.closePeek()
    // little window
    S.openExternal(base + '/second'); await until(async () => S.little() && S.little().view.webContents.getTitle() === 'Second page')
    ok('link from another app opens in the little window', !!S.little() && S.little().view.webContents.getURL() === base + '/second')
    await sleep(500); await snap(S.little().bar, 'little-bar')
    const nn = a.tabs().length, lv = S.little().view.webContents, lb = S.little().bar.webContents
    await js(lb, `document.querySelector('#mv').click()`); await sleep(800)
    ok('little window moves the page to the main window', S.little() === null && a.tabs().length === nn + 1 && a.cur().url === base + '/second')
    ok('closed little window frees its pages', lv.isDestroyed() && lb.isDestroyed())
    S.settings().littleExternal = false; S.openExternal(base + '/'); await sleep(500); ok('little window can be turned off', S.little() === null && a.cur().url === base + '/'); S.settings().littleExternal = true
  })

  await section('media', async () => {
    reset(); await sleep(300)
    const v = await open('/video'); await until(async () => js(v.view.webContents, `!document.getElementById('v').paused`))
    ok('video plays', await js(v.view.webContents, `!document.getElementById('v').paused`))
    ok('playing tab is tracked for the mini player', await until(async () => S.mediaTab() === v.id))
    const o = await open('/second'); await sleep(1200)
    ok('video goes picture-in-picture when you leave its tab', await until(async () => await js(v.view.webContents, `!!document.pictureInPictureElement`), 6000))
    ok('mini player appears in the sidebar', await uiN('#mini .card') === 1); await snap(a.ui(), 'sidebar-mini')
    await js(ui(), `document.querySelector('[data-m=toggle]').click()`)
    ok('mini player pauses the video', await until(async () => await js(v.view.webContents, `document.getElementById('v').paused`)))
    a.activate(v.id); await sleep(600)
    ok('coming back leaves picture-in-picture', await until(async () => !(await js(v.view.webContents, `!!document.pictureInPictureElement`))))
    ok('mini player hides on its own tab', await uiN('#mini .card') === 0)
    S.settings().autoPip = false; await js(v.view.webContents, `document.getElementById('v').play()`); await sleep(500); a.activate(o.id); await sleep(1000)
    ok('picture-in-picture can be turned off', !(await js(v.view.webContents, `!!document.pictureInPictureElement`))); S.settings().autoPip = true
  })

  await section('sidebar and shortcuts', async () => {
    reset(); await sleep(300); const t = await open('/')
    S.toggleSidebar(); await sleep(300)
    ok('sidebar collapses and the page grows', !S.sidebar() && t.view.getBounds().x === 8 && !ui().isDestroyed(), JSON.stringify(t.view.getBounds()))
    S.edge().webContents.sendInputEvent({ type: 'mouseMove', x: 2, y: 300 }); await sleep(500)
    ok('hovering the left edge reveals the sidebar over the page', S.floating() && a.ui().getBounds().width === 262, 'floating=' + S.floating()); await snap(a.ui(), 'sidebar-floating')
    ui().sendInputEvent({ type: 'mouseMove', x: 100, y: 200 }); ui().sendInputEvent({ type: 'mouseLeave', x: 400, y: 200 }); await sleep(500)
    ok('moving away hides the sidebar again', !S.floating(), 'floating=' + S.floating())
    const shownBy = []
    for (const opts of [undefined, { window: a.win() }]) { // native menus must appear for a BaseWindow
      const { Menu } = require('electron'), menu = Menu.buildFromTemplate([{ label: 'x' }]); let shown = false
      menu.on('menu-will-show', () => { shown = true }); setTimeout(() => menu.popup(opts), 0); await sleep(600); menu.closePopup(); await sleep(200)
      shownBy.push(shown)
    }
    ok('context menu shows', shownBy.some(Boolean), JSON.stringify(shownBy))
    S.toggleSidebar(); await sleep(300); ok('sidebar comes back', S.sidebar() && t.view.getBounds().x === 262)
    // the command palette sits in the middle of the page area, not of the whole window
    const cmdCenter = async () => { a.openCmd('new'); await sleep(900); const r = await js(a.cmd().webContents, `(() => { const b = document.getElementById('box').getBoundingClientRect(); return { mid: b.x + b.width / 2, w: innerWidth } })()`); a.closeCmd(); await sleep(300); return r }
    const pageMid = () => { const b = t.view.getBounds(); return b.x + b.width / 2 }
    let cc = await cmdCenter(); ok('palette is centered over the page (sidebar open)', Math.abs(cc.mid - pageMid()) <= 2, `palette=${cc.mid} page=${pageMid()}`)
    S.toggleSidebar(); await sleep(300); cc = await cmdCenter(); ok('palette is centered over the page (sidebar collapsed)', Math.abs(cc.mid - pageMid()) <= 2, `palette=${cc.mid} page=${pageMid()}`); S.toggleSidebar(); await sleep(300)
    const key = (k, extra = {}) => { let prevented = false; S.shortcut({ preventDefault: () => { prevented = true } }, { type: 'keyDown', key: k, control: process.platform !== 'darwin', meta: process.platform === 'darwin', alt: false, shift: false, ...extra }); return prevented }
    ok('Ctrl+F opens find', key('f') && S.findOpen()); S.closeFind()
    ok('Ctrl+S toggles the sidebar', key('s') && !S.sidebar()); key('s')
    ok('a plain key does nothing', !key('f', { control: false, meta: false }))
    const set = (act, c) => js(panel(), `api.call('setShortcut', ${JSON.stringify(act)}, ${JSON.stringify(c)})`)
    ok('shortcut can be changed', (await set('find', 'Mod+Shift+K')).ok === true)
    ok('old shortcut no longer works', !key('f')); ok('new shortcut works', key('k', { shift: true }) && S.findOpen()); S.closeFind()
    ok('conflicting shortcut is refused', (await set('print', 'Mod+Shift+K')).error?.includes('Find in page'))
    ok('shortcut needs a modifier', !!(await set('print', 'P')).error)
    ok('F12 stays reserved for developer tools', (await set('reload', 'F12')).error?.includes('F12'))
    ok('shortcut can be reset', (await set('find', null)).ok === true && key('f')); S.closeFind()
    S.openPanel('settings'); await sleep(600); await js(panel(), `document.querySelector('[data-a=record]').click()`); await sleep(200)
    panel().sendInputEvent({ type: 'keyDown', keyCode: 'U', modifiers: [process.platform === 'darwin' ? 'meta' : 'control', 'shift'] }); panel().sendInputEvent({ type: 'keyUp', keyCode: 'U', modifiers: [process.platform === 'darwin' ? 'meta' : 'control', 'shift'] }); await sleep(500)
    ok('shortcut recorder captures a key press', await until(async () => S.settings().shortcuts.newTab === 'Mod+Shift+U'), JSON.stringify(S.settings().shortcuts)); S.settings().shortcuts = {}; S.closePanel()
  })

  await section('extensions', async () => {
    reset(); await sleep(300)
    const { zipSync } = require('fflate'), crypto = require('crypto')
    const der = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'der' })
    const varint = n => { const o = []; do { o.push(n & 127 | (n > 127 ? 128 : 0)); n >>= 7 } while (n); return Buffer.from(o) }
    const pb = (tag, buf) => Buffer.concat([Buffer.from([tag << 3 | 2]), varint(buf.length), buf])
    const header = Buffer.concat([pb(2, pb(1, der)), pb(10000, pb(1, crypto.createHash('sha256').update(der).digest().subarray(0, 16)))])
    const zip = zipSync({ 'manifest.json': Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Heliarc test extension', version: '1.2', content_scripts: [{ matches: ['<all_urls>'], js: ['c.js'], run_at: 'document_start' }] })), 'c.js': Buffer.from(`document.documentElement.dataset.heliarcExt = 'on'`) })
    const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
    const crx = Buffer.concat([Buffer.from('Cr24'), u32(3), u32(header.length), header, Buffer.from(zip)])
    const r = await S.ext.installCrx(crx, S.spaceSessions())
    ok('extension installs from a CRX package', r.name === 'Heliarc test extension' && r.version === '1.2', JSON.stringify(r))
    ok('extension keeps its Chrome Web Store id', r.id === S.ext.idOf(der), r.id)
    const attr = async t => js(t.view.webContents, `document.documentElement.dataset.heliarcExt || 'off'`)
    const home = await open('/'), work = await open('/', 1)
    ok('extension runs in the first space', await attr(home) === 'on'); ok('extension runs in every space', await attr(work) === 'on')
    // a package Chromium refuses reports an error, leaves no folder behind and keeps the installed version
    const bad = (m, extra = {}) => Buffer.concat([Buffer.from('Cr24'), u32(3), u32(header.length), header, Buffer.from(zipSync({ 'manifest.json': Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Broken', version: '2.0', content_scripts: [{ matches: [m], js: ['c.js'] }], ...extra })), 'c.js': Buffer.from('1') }))])
    const root = path.join(require('electron').app.getPath('userData'), 'extensions')
    const err = await S.ext.installCrx(bad('bogus'), S.spaceSessions()).then(() => null, e => e.message)
    ok('a broken extension reports an error', /install the extension/.test(err), err)
    ok('failed update keeps the working version', fs.readdirSync(root).filter(n => !n.startsWith('.')).join() === r.id && S.ext.list(S.spaceSessions()[0]).some(x => x.id === r.id && x.name === 'Heliarc test extension'), fs.readdirSync(root).join())
    ok('failed install leaves no leftovers', !fs.readdirSync(root).some(n => n.startsWith('.')), fs.readdirSync(root).join())
    // CRX2 packages keep the store id too
    const crx2 = Buffer.concat([Buffer.from('Cr24'), u32(2), u32(der.length), u32(4), der, Buffer.from('sig!'), Buffer.from(zip)])
    const r2 = await S.ext.installCrx(crx2, S.spaceSessions())
    ok('CRX2 package keeps its id and replaces the old copy', r2.id === S.ext.idOf(der) && fs.readdirSync(root).length === 1, JSON.stringify(r2))
    S.openPanel('extensions'); await sleep(700)
    ok('extensions panel lists it', await js(panel(), `document.body.innerText.includes('Heliarc test extension')`)); await snap(S.panel(), 'panel-extensions')
    await js(panel(), `document.querySelector('#extin').value = 'not an id'; document.querySelector('[data-a=installExt]').click()`)
    ok('bad extension id shows an error', await until(async () => await js(panel(), `document.querySelector('.msg.bad')?.innerText.includes('32-letter')`)))
    await js(panel(), `document.querySelector('[data-a=removeExt]').click()`)
    ok('extension can be removed', await until(async () => S.ext.list(S.spaceSessions()[0]).length === 0))
    const after = await open('/second'); ok('removed extension no longer runs', await attr(after) === 'off')
    S.closePanel()
  })

  await section('shortcut hints follow the OS', async () => {
    reset(); await sleep(300)
    const mac = process.platform === 'darwin', want = { edit: mac ? '⌘L' : 'Ctrl+L', newTab: mac ? '⌘T' : 'Ctrl+T', split: mac ? '⌘⇧S' : 'Ctrl+Shift+S' }
    const blank = a.newTab(); await until(async () => blank.title !== 'New tab' || !blank.loading); await sleep(500)
    ok('new tab page names the address shortcut for this OS', await js(blank.view.webContents, `document.getElementById('k').textContent`) === want.edit, await js(blank.view.webContents, `document.getElementById('k').textContent`))
    ok('sidebar button shows the new-tab shortcut for this OS', await js(ui(), `document.querySelector('#newbtn small').textContent`) === want.newTab)
    ok('address tooltip shows the shortcut for this OS', await js(ui(), `document.querySelector('#pill').title`) === `Edit address (${want.edit})`)
    S.openPanel('settings'); await sleep(700)
    ok('settings list shortcuts for this OS', await js(panel(), `[...document.querySelectorAll('.line')].find(l => l.innerText.startsWith('Split view')).querySelector('kbd').textContent`) === want.split)
    // macOS formatting, checked by running the page's own formatter with a Mac platform
    const macText = await js(blank.view.webContents, `(() => { const el = { textContent: '' }; new Function('navigator', 'location', 'document', document.querySelector('script').textContent)({ platform: 'MacIntel' }, { hash: '#Mod%2BShift%2BK' }, { getElementById: () => el }); return el.textContent })()`)
    ok('macOS shows symbols (⌘⇧K)', macText === '⌘⇧K', macText)
    await js(panel(), `api.call('setShortcut', 'editAddress', 'Mod+Shift+K')`); const b2 = a.newTab(); await sleep(1000)
    ok('new tab page follows a customized shortcut', await js(b2.view.webContents, `document.getElementById('k').textContent`) === (mac ? '⌘⇧K' : 'Ctrl+Shift+K'))
    await js(panel(), `api.call('setShortcut', 'editAddress', null)`); S.closePanel()
  })

  await section('session restore', async () => {
    const tf = path.join(require('electron').app.getPath('userData'), 'throttle-test.json')
    for (let i = 0; i < 14; i++) { S.store.save('throttle-test', { i }); await sleep(100) } // constant activity must not postpone saving forever
    ok('saving still happens during constant activity', fs.existsSync(tf) && !fs.existsSync(tf + '.tmp'))
    reset(); await sleep(300); const t1 = await open('/'), t2 = await open('/second'); S.place(t1.id, 'pinned'); S.place(t2.id, 'fav'); const f = S.newFolder(); S.push(); S.store.flushAll()
    const saved = JSON.parse(fs.readFileSync(path.join(require('electron').app.getPath('userData'), 'session.json'), 'utf8'))
    ok('session is saved to disk', saved.tabs.length === a.tabs().length && saved.tabs.some(t => t.pinned && t.url === base + '/') && saved.tabs.some(t => t.fav) && saved.folders.some(x => x.id === f), `tabs=${saved.tabs.length}`)
  })

  server.close()
}
