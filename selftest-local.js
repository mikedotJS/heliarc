// Feature tests that need no internet: they drive the real browser against a local HTTP server.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await fn().catch(() => false)) return true; await sleep(100) } return false }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const VIDEO = `<title>Video</title><video id=v width=320 height=180></video><canvas id=c width=320 height=180></canvas><script>const c=document.getElementById('c'),g=c.getContext('2d');setInterval(()=>{g.fillStyle='hsl('+(Date.now()/10%360)+',80%,50%)';g.fillRect(0,0,320,180)},30);const v=document.getElementById('v');v.srcObject=c.captureStream(30);v.play()</script>`
const PAGES = {
  '/': '<title>Local home</title><h1>hello</h1><p>needle needle needle</p><a id=l href="/second">second</a>',
  '/second': '<title>Second page</title><p>second</p>',
  '/wide': '<title>Wide</title><body style="margin:0;min-width:1200px"><p>wide</p>',
  '/login': '<title>Login</title><form id=f method=post action=/done><input id=u name=user type=text><input id=p name=pass type=password><button type=button id=eye>Show</button><button>Go</button></form>',
  '/done': '<title>Done</title>ok',
  '/darktop': '<title>Dark top</title><body style="margin:0;background:#112233;color:#fff"><p>night</p>',
  '/profile': '<title>Profile</title><form><input id=em autocomplete=email><input id=fn autocomplete=given-name><input id=ci autocomplete=address-level2></form>',
  '/video': VIDEO,
  '/popup-opener': '<title>Popup opener</title><script>window.got = null; addEventListener("message", e => got = e.data)</script>',
  '/popup-child': '<title>Popup</title><script>opener ? opener.postMessage(JSON.stringify({ hi: 1, node: typeof require + typeof process }), "*") : document.title = "no opener"; setTimeout(() => close(), 300)</script>',
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
    if (u === '/secret') { if (q.headers.authorization !== 'Basic ' + Buffer.from('mike:pw').toString('base64')) { r.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Test area"' }); return r.end('no') } r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end('<title>Welcome</title>welcome') }
    if (u === '/embed3p') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(`<title>Embed</title><img src="http://localhost:${server.address().port}/tpcookie">`) }
    if (u === '/tpcookie') { r.writeHead(200, { 'Content-Type': 'image/png', 'Set-Cookie': 'tp=1; Path=/; SameSite=None; Secure' }); return r.end(PNG) } // what an embedded tracker sends
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
    const nf = await js(ui(), `(() => { const b = document.querySelector('#nf').getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`)
    ui().sendInputEvent({ type: 'mouseMove', ...nf }); await sleep(400)
    ok('hovering "new folder" lightens the button (no black fill)', await js(ui(), `getComputedStyle(document.querySelector('#nf')).backgroundColor`) === 'rgba(255, 255, 255, 0.16)', await js(ui(), `getComputedStyle(document.querySelector('#nf')).backgroundColor`))
    const tabBox = () => js(ui(), `(() => { const b = document.querySelector('.tab').getBoundingClientRect(); return { x: Math.round(b.x + 40), y: Math.round(b.y + b.height / 2), h: b.height } })()`)
    const rest = await tabBox(); ui().sendInputEvent({ type: 'mouseMove', x: rest.x, y: rest.y }); await sleep(400)
    ok('a tab keeps its height on hover', (await tabBox()).h === rest.h, `${rest.h} → ${(await tabBox()).h}`)
    ui().sendInputEvent({ type: 'mouseMove', x: 100, y: 600 })
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
    const fhBox = () => js(ui(), `(() => { const b = document.querySelector('.fh').getBoundingClientRect(); return { x: Math.round(b.x + 60), y: Math.round(b.y + b.height / 2), h: b.height } })()`)
    const fh0 = await fhBox(); ui().sendInputEvent({ type: 'mouseMove', x: fh0.x, y: fh0.y }); await sleep(400)
    ok('a folder keeps its height on hover', (await fhBox()).h === fh0.h, `${fh0.h} → ${(await fhBox()).h}`)
    ui().sendInputEvent({ type: 'mouseMove', x: 100, y: 700 })
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
    const swipe = dx => js(ui(), `document.querySelector('#side').dispatchEvent(new WheelEvent('wheel', { deltaX: ${dx}, deltaY: 0, bubbles: true }))`)
    await swipe(90); await sleep(400)
    ok('swiping the sidebar left goes to the next space', S.space() === 1, 'space=' + S.space())
    await sleep(700); await swipe(-90); await sleep(400)
    ok('swiping it right goes back', S.space() === 0, 'space=' + S.space())
    await sleep(700); await swipe(-90); await sleep(400)
    ok('swiping past the first space does nothing', S.space() === 0)
    // right-click menus on the sidebar: capture the template instead of showing a native menu
    const { Menu } = require('electron'), realBuild = Menu.buildFromTemplate; let menu = null
    Menu.buildFromTemplate = t => { menu ??= t; const m = realBuild(t); m.popup = () => {}; return m }
    const rclick = sel => (menu = null, js(ui(), `document.querySelector('${sel}').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))`))
    await rclick('#folders .fh'); await sleep(200)
    ok('right-click on a folder offers rename and delete', menu?.some(m => m.label === 'Rename folder') && menu.some(m => m.label === 'Delete folder'), JSON.stringify(menu?.map(m => m.label)))
    await rclick('#foot'); await sleep(200)
    const nFolders = S.folders().length, newF = menu?.find(m => m.label === 'New folder')
    ok('right-click on the sidebar offers new tab, folder and spaces', !!newF && menu.some(m => m.label === 'Switch space') && menu.some(m => m.label === 'New tab'), JSON.stringify(menu?.map(m => m.label)))
    newF?.click(); await sleep(200)
    ok('its New folder entry creates a folder', S.folders().length === nFolders + 1)
    S.delFolder(S.folders().at(-1).id); Menu.buildFromTemplate = realBuild
    // two-finger swipe on a page = back / forward
    const nav = await open('/'), navUrl = () => nav.view.webContents.getURL()
    await js(nav.view.webContents, `location.href = '/second'`); await until(async () => navUrl().endsWith('/second'))
    const wheel = dx => js(nav.view.webContents, `document.body.dispatchEvent(new WheelEvent('wheel', { deltaX: ${dx}, deltaY: 0, bubbles: true }))`)
    await wheel(-150); let moved = false
    for (let i = 0; i < 40 && !moved; i++) { moved = await js(nav.view.webContents, `document.getAnimations().some(x => x.effect.target === document.documentElement)`).catch(() => false); await sleep(15) }
    ok('the swipe plays a short slide animation', moved)
    ok('swiping right on a page goes back', await until(async () => navUrl() === base + '/'), navUrl())
    await sleep(1000); await wheel(150); ok('swiping left on a page goes forward', await until(async () => navUrl().endsWith('/second')), navUrl())
    a.closeTab(nav.id)
    // privacy defaults
    const pv = require('./lib/privacy'), ses0 = S.spaceSessions()[0]
    ok('http addresses are upgraded to https', pv.upgrade('http://example.com/a?b=1') === 'https://example.com/a?b=1')
    ok('local and private addresses are not upgraded', ['http://localhost:3000/', 'http://127.0.0.1/', 'http://192.168.1.2/', 'http://nas/', 'https://example.com/'].every(u => pv.upgrade(u) === null))
    await ses0.cookies.remove('http://localhost:' + base.split(':')[2], 'tp').catch(() => {})
    const emb = await open('/embed3p'); await sleep(800)
    ok('a third-party cookie is not stored', (await ses0.cookies.get({ name: 'tp', domain: 'localhost' })).length === 0)
    ok('the page looks like a plain Chrome', !/Electron|Heliarc/.test(await js(emb.view.webContents, 'navigator.userAgent')), await js(emb.view.webContents, 'navigator.userAgent'))
    ok('every visitor reports the same hardware', await js(emb.view.webContents, 'navigator.hardwareConcurrency === 4 && navigator.deviceMemory === 8'))
    ok('the page is a "Google Chrome" brand, which Google sign-in requires', await js(emb.view.webContents, 'navigator.userAgentData.brands.some(b => b.brand === "Google Chrome") && navigator.userAgentData.getHighEntropyValues(["fullVersionList"]).then(r => r.fullVersionList.some(b => b.brand === "Google Chrome"))'))
    const wcE = emb.view.webContents, area = () => a.win().getContentBounds(), placed = emb.view.getBounds() // a video's fullscreen button: the page fills the whole window, then goes back
    await wcE.executeJavaScript('void document.documentElement.requestFullscreen()', true); for (let i = 0; i < 30 && emb.view.getBounds().x !== 0; i++) await sleep(200); await sleep(800) // the window itself takes a moment to go fullscreen
    ok('a page can go fullscreen over the sidebar', emb.view.getBounds().x === 0 && emb.view.getBounds().y === 0 && emb.view.getBounds().width === area().width, JSON.stringify([emb.view.getBounds(), area()]))
    wcE.executeJavaScript('void document.exitFullscreen()'); for (let i = 0; i < 30 && emb.view.getBounds().x === 0; i++) await sleep(200); await sleep(1500)
    ok('and comes back to its place', emb.view.getBounds().x === placed.x && emb.view.getBounds().y === placed.y, JSON.stringify(emb.view.getBounds()))
    ok('WebRTC hides the local address', emb.view.webContents.getWebRTCIPHandlingPolicy() === 'default_public_interface_only')
    S.settings().blockThirdPartyCookies = false; const emb2 = await open('/embed3p'); await sleep(800) // control: with the setting off, the same embed does store its cookie
    ok('(control) the cookie is stored when the setting is off', (await ses0.cookies.get({ name: 'tp', domain: 'localhost' })).length === 1)
    S.settings().blockThirdPartyCookies = true; await ses0.cookies.remove('http://localhost:' + base.split(':')[2], 'tp').catch(() => {})
    // third-party cookies can be allowed on one site and stay blocked on the others
    S.settings().cookiesOk = ['example.org']; const emb3 = await open('/embed3p'); await sleep(800)
    ok('allowing another site changes nothing here', (await ses0.cookies.get({ name: 'tp', domain: 'localhost' })).length === 0, 'cookies stored: ' + (await ses0.cookies.get({ name: 'tp', domain: 'localhost' })).length)
    S.settings().cookiesOk = []; await js(ui(), "api.call('toggleSite', 'cookies')"); await sleep(1500)
    ok('third-party cookies can be turned off for this site, and the sidebar says so', S.settings().cookiesOk.join() === '127.0.0.1' && (await ses0.cookies.get({ name: 'tp', domain: 'localhost' })).length === 1 && /1 protection off on 127\.0\.0\.1/.test(await js(ui(), "document.querySelector('#shield').innerText")), JSON.stringify(S.settings().cookiesOk))
    await js(panel(), "api.call('toggleSite', 'cookies', '127.0.0.1')"); await ses0.cookies.remove('http://localhost:' + base.split(':')[2], 'tp').catch(() => {})
    ok('and blocked again from Settings', S.settings().cookiesOk.length === 0); a.closeTab(emb3.id)
    // a sign-in popup (window.open with a size) stays linked to the page that opened it; a plain link still opens a tab
    const po = await open('/popup-opener'), n0 = a.tabs().length
    await js(po.view.webContents, "void window.open('/popup-child', 'signin', 'width=420,height=560')")
    ok('a sign-in popup reports back to the page that opened it', await until(async () => await js(po.view.webContents, 'window.got') !== null) && JSON.parse(await js(po.view.webContents, 'window.got')).hi === 1, String(await js(po.view.webContents, 'window.got')))
    ok('as a window of its own, not a tab, and sandboxed like a page', a.tabs().length === n0 && JSON.parse(await js(po.view.webContents, 'window.got')).node === 'undefinedundefined', n0 + ' / ' + a.tabs().length)
    const known = new Set(a.tabs().map(x => x.id)); await js(po.view.webContents, "void window.open('/second', '_blank')"); await sleep(800)
    ok('a plain link or window.open without a size still opens a tab', a.tabs().length === n0 + 1, String(a.tabs().length)); for (const t of a.tabs().filter(x => !known.has(x.id))) a.closeTab(t.id); a.closeTab(po.id)
    a.closeTab(emb.id); a.closeTab(emb2.id)
    // search engine and custom bangs
    const bg = require('./bangs'), mine = [{ trigger: 'npm', url: 'https://www.npmjs.com/search?q=%s' }]
    ok('the search engine can be changed', bg.resolve('cats', { searchEngine: 'ddg' }) === 'https://duckduckgo.com/?q=cats' && bg.resolve('cats').startsWith('https://search.brave.com/'))
    await js(ui(), "api.call('setSetting', 'searchEngine', 'google')"); await sleep(300)
    ok('the engine chosen in the settings is the one used for a search', a.resolve('cats') === 'https://www.google.com/search?q=cats', a.resolve('cats'))
    await js(ui(), "api.call('setSetting', 'searchEngine', 'brave')"); await sleep(300)
    ok('your own bangs work and win over built-in ones', bg.resolve('!npm left pad', { bangs: mine }) === 'https://www.npmjs.com/search?q=left%20pad' && bg.resolve('!g x', { bangs: [{ trigger: 'g', url: 'https://example.com/?q=%s' }] }) === 'https://example.com/?q=x')
    ok('built-in bangs work in capitals too', bg.resolve('!W cats') === 'https://en.wikipedia.org/w/index.php?search=cats')
    ok('names that only exist on every object are not bangs', bg.resolve('!constructor cats').startsWith('https://search.brave.com/') && bg.resolve('!__proto__ cats').startsWith('https://search.brave.com/'))
    await js(ui(), "api.call('setSetting', 'searchEngine', 'constructor')"); await sleep(300)
    ok('an unknown search engine name is refused', S.settings().searchEngine === 'brave', S.settings().searchEngine)
    const ua = () => S.spaceSessions()[0].getUserAgent()
    await js(ui(), "api.call('setSetting', 'fingerprint', false)"); await sleep(300)
    ok('turning fingerprint protection off shows the real browser identity at once', /Electron/.test(ua()), ua())
    await js(ui(), "api.call('setSetting', 'fingerprint', true)"); await sleep(300)
    ok('and turning it back on hides it again, without a restart', !/Electron|Heliarc/.test(ua()), ua())
    S.settings().pwNever.push('https://never.example'); await js(ui(), "api.call('allowPw', 'https://never.example')"); await sleep(300)
    ok('a site the user said "never" to for passwords can be allowed again', !S.settings().pwNever.includes('https://never.example'))
    ok('the bang list has the built-in ones, and your own first and without duplicates', (l => l[0].trigger === 'g' && l[0].url === 'https://example.com/?q=%s' && l.filter(x => x.trigger === 'g').length === 1 && l.find(x => x.trigger === 'yt').name === 'YouTube' && l.find(x => x.trigger === 'npm'))(bg.list([{ trigger: 'g', url: 'https://example.com/?q=%s' }])))
    ok('the new built-in bangs work', bg.resolve('!so left pad') === 'https://stackoverflow.com/search?q=left%20pad' && bg.resolve('!gm paris') === 'https://www.google.com/maps/search/paris')
    // a file on this computer opens as a page: by its path in the address bar, and from the system (Open with…)
    const page = path.join(os.tmpdir(), 'heliarc test page.html'); fs.writeFileSync(page, '<title>Opened from disk</title><p>local file</p>')
    ok('a path to a file on this computer opens it instead of searching', bg.resolve(page) === require('url').pathToFileURL(page).href && bg.resolve('"' + page + '"') === bg.resolve(page) && bg.resolve(os.tmpdir() + '/no such file.html').startsWith('https://search.'), bg.resolve(page))
    ok('and the system can hand over web page files only', bg.localFile(page, true) === bg.resolve(page) && bg.localFile(process.execPath, true) === null && bg.localFile('page.html', true) === null)
    const fileTab = a.newTab(page); await sleep(1500); await until(async () => fileTab.title === 'Opened from disk')
    ok('the page shows', fileTab.title === 'Opened from disk', fileTab.title); a.closeTab(fileTab.id); fs.rmSync(page, { force: true })
    a.openCmd('new'); await sleep(900)
    const typed = async v => js(a.cmd().webContents, `(async () => { const i = document.getElementById('in'); i.value = ${JSON.stringify(v)}; i.oninput(); await new Promise(r => setTimeout(r, 300)); return [...document.querySelectorAll('.row')].map(r => r.textContent) })()`)
    const listed = await typed('!yt'), going = await typed('!yt lofi')
    const tagged = await js(a.cmd().webContents, `(() => { const t = document.getElementById('tag'), i = document.getElementById('in'); const s = [t.hidden, t.textContent, getComputedStyle(t).backgroundColor, i.value]; i.setSelectionRange(0, 0); i.onkeydown({ key: 'Backspace', preventDefault() {} }); return [s, t.hidden, i.value] })()`)
    // a visited site is offered as the end of what is typed: selected, so typing goes on over it; Tab accepts, Backspace drops it
    const cw = () => a.cmd().webContents, seen = await js(cw(), "api.call('history', '127.0.0')")
    const autoc = (v, ev) => js(cw(), `(async () => { const i = document.getElementById('in'); i.value = ${JSON.stringify(v)}; i.oninput(${ev || ''}); await new Promise(r => setTimeout(r, 300)); return [i.value, i.selectionStart, i.selectionEnd, document.querySelector('.row').textContent] })()`)
    const offered = await autoc('127.0.0')
    ok('typing the start of a visited site offers its address, the rest selected', seen.length > 0 && offered[0] === '127.0.0.1' && offered[1] === 7 && offered[2] === 9, JSON.stringify([seen.length, offered]))
    ok('and the first line of the list is that site', /Open “127\.0\.0\.1” in a new tab/.test(offered[3]), offered[3])
    const accepted = await js(cw(), "(() => { const i = document.getElementById('in'); i.onkeydown({ key: 'Tab', preventDefault() {} }); return [i.value, i.selectionStart, i.selectionEnd] })()")
    ok('Tab accepts it', JSON.stringify(accepted) === '["127.0.0.1",9,9]', JSON.stringify(accepted))
    const deleted = await autoc('127.0.0', "{ inputType: 'deleteContentBackward' }")
    ok('deleting does not bring it back', deleted[0] === '127.0.0' && deleted[1] === 7 && deleted[2] === 7, JSON.stringify(deleted))
    const nope = await autoc('qqqnever'), spaced = await autoc('127.0.0 x')
    ok('an unknown site, or a search with spaces, offers nothing', nope[0] === 'qqqnever' && spaced[0] === '127.0.0 x', JSON.stringify([nope, spaced]))
    a.closeCmd(); await sleep(300)
    ok('a full bang becomes a tag in the site\'s colour, and only the search stays typed', JSON.stringify(tagged[0]) === JSON.stringify([false, 'YouTube', 'rgb(255, 0, 51)', 'lofi']), JSON.stringify(tagged[0]))
    ok('Backspace at the start turns the tag back into text', tagged[1] === true && tagged[2] === '!yt lofi', JSON.stringify(tagged.slice(1)))
    ok('typing ! in the command bar lists the matching bangs', /!yt.*YouTube/.test(listed[0]), JSON.stringify(listed))
    ok('and a full bang says where it will search', /Search YouTube for “lofi”/.test(going[0]), JSON.stringify(going))
    await js(ui(), "api.call('editSpace', 1, { name: ' Studio ', icon: 'palette', c1: '#112233', c2: 'red' })"); await sleep(300)
    ok('a space can be renamed and given another icon and colour', S.SPACES[1].name === 'Studio' && S.SPACES[1].icon === 'palette' && S.SPACES[1].c1 === '#112233' && S.SPACES[1].c2 === '#2b6fff', JSON.stringify(S.SPACES[1]))
    ok('and it is kept in the settings, so it comes back after a restart', S.settings().spaces[1]?.name === 'Studio' && !('c2' in S.settings().spaces[1]), JSON.stringify(S.settings().spaces))
    await js(ui(), "api.call('editSpace', 3, { name: 'Hacked' })"); await sleep(200)
    ok('the Private space cannot be changed', S.SPACES[3].name === 'Private')
    await js(ui(), "api.call('editSpace', 1, { name: 'Work', icon: 'briefcase', c1: '#0aa6a6', c2: '#2b6fff' })"); await sleep(200)
    { const sd = await open('/'); a.activate(sd.id); await sleep(300); const w = a.win().getContentBounds().width, L = S.content()
      await js(ui(), "api.call('setSetting', 'sidebarSide', 'right')"); await sleep(400)
      const R = S.content(), page = sd.view.getBounds()
      ok('the sidebar can go to the right: the page moves to the left edge', L.x > 100 && R.x < 20 && R.w === L.w && page.x === R.x && page.x + page.width <= w - 100, JSON.stringify({ L, R, page, w }))
      ok('the sidebar page knows it is on the right', await js(ui(), "document.body.classList.contains('right') && getComputedStyle(document.getElementById('side')).marginLeft !== '0px'"))
      await js(ui(), "api.call('setSetting', 'sidebarSide', 'sideways')"); await sleep(200)
      ok('anything but left or right is ignored', S.settings().sidebarSide === 'right')
      await js(ui(), "api.call('toggleSidebar')"); await sleep(300)
      ok('a collapsed sidebar reveals from the right edge too', S.edge().getBounds().x > w - 20, JSON.stringify(S.edge().getBounds()))
      await js(ui(), "api.call('toggleSidebar')"); await sleep(300)
      await js(ui(), "api.call('setSetting', 'sidebarSide', 'left')"); await sleep(400)
      ok('and back to the left', S.content().x === L.x && S.settings().sidebarSide === 'left'); a.closeTab(sd.id) }
    ok('built-in bangs still work', bg.resolve('!w cats') === 'https://en.wikipedia.org/w/index.php?search=cats')
    // ads can be allowed on one site
    const sitePage = await open('/'); a.activate(sitePage.id); await sleep(300)
    await js(ui(), "api.call('toggleSite', 'ads')"); await sleep(400)
    ok('ads can be allowed on the current site', S.settings().adblockOff.includes('127.0.0.1'), JSON.stringify(S.settings().adblockOff))
    await js(ui(), "api.call('toggleSite', 'ads')"); await sleep(400)
    ok('and blocked again', !S.settings().adblockOff.includes('127.0.0.1'))
    // the Site protections window: this site's switches and every site with something turned off
    const hw = () => js(sitePage.view.webContents, 'navigator.hardwareConcurrency')
    ok('the hardware is masked by default', await hw() === 4, String(await hw()))
    await js(ui(), "api.call('openPanel', 'protections')"); await until(async () => js(panel(), "document.querySelectorAll('[data-a=prot]').length === 4"))
    ok('the window lists the four protections of the current site, all on', await js(panel(), "[...document.querySelectorAll('[data-a=prot]')].every(i => i.checked) && /127\\.0\\.0\\.1/.test(document.body.innerText)"))
    await js(panel(), "document.querySelector('[data-kind=fingerprint]').click()"); await sleep(1500)
    ok('turning one off applies to that site only', S.settings().fingerprintOff.join() === '127.0.0.1' && await hw() === require('os').cpus().length && S.settings().adblockOff.length === 0, String(await hw()))
    await js(panel(), "document.querySelector('[data-kind=webrtc]').click()"); await sleep(1500)
    ok('WebRTC follows the site it is on', sitePage.view.webContents.getWebRTCIPHandlingPolicy() === 'default', sitePage.view.webContents.getWebRTCIPHandlingPolicy())
    ok('the sidebar counts what is off here', /2 protections off on 127\.0\.0\.1/.test(await js(ui(), "document.querySelector('#shield').innerText")), await js(ui(), "document.querySelector('#shield').innerText"))
    ok('and the site is listed with what is off', await until(async () => js(panel(), "/Off: same hardware as everyone, hide my local network address/.test(document.body.innerText)")))
    await js(panel(), "document.querySelector('[data-a=protReset]').click()"); await sleep(1500)
    ok('turning everything back on resets the site', S.settings().fingerprintOff.length === 0 && S.settings().webrtcOff.length === 0 && await hw() === 4 && sitePage.view.webContents.getWebRTCIPHandlingPolicy() === 'default_public_interface_only')
    S.closePanel(); await sleep(300)
    a.closeTab(sitePage.id)
    // site permissions: ask once, remember, and let the user change their mind
    const { dialog } = require('electron'), realBox = dialog.showMessageBox; let asked = []
    dialog.showMessageBox = async (_, o) => { asked.push(o.message); return { response: 1, checkboxChecked: true } }
    const pp = await open('/'); const notif = () => js(pp.view.webContents, 'Notification.requestPermission()')
    ok('a site is asked before it can show notifications', await notif() === 'granted' && asked.length === 1 && /127.0.0.1 wants to show notifications/.test(asked[0]), JSON.stringify(asked))
    ok('the answer is remembered', S.settings().sitePerms['127.0.0.1']?.notifications === true)
    await notif(); ok('and it is not asked twice', asked.length === 1)
    await js(ui(), "api.call('setSitePerm', '127.0.0.1', 'notifications', false)"); await sleep(300)
    ok('a remembered permission can be changed', S.settings().sitePerms['127.0.0.1'].notifications === false)
    await js(ui(), "api.call('setSitePerm', '127.0.0.1', 'notifications', null)"); await sleep(300)
    ok('or forgotten', !S.settings().sitePerms['127.0.0.1'])
    const wcP = pp.view.webContents, asks = asked.length
    ok('the screen can be kept awake without a question', await wcP.executeJavaScript("navigator.wakeLock.request('screen').then(l => (l.release(), 'ok'), e => e.name)", true) === 'ok')
    ok('copy buttons work without a question', await wcP.executeJavaScript("navigator.clipboard.writeText('x').then(() => 'ok', e => e.name)", true) === 'ok' && asked.length === asks)
    S.settings().sitePerms['127.0.0.1'] = { camera: true }
    ok('a camera allowed for the site shows as granted to the page', await wcP.executeJavaScript("navigator.permissions.query({ name: 'camera' }).then(p => p.state)") === 'granted')
    S.settings().sitePerms['127.0.0.1'] = { camera: false }
    ok('a camera refused for the site shows as denied', await wcP.executeJavaScript("navigator.permissions.query({ name: 'camera' }).then(p => p.state)") === 'denied')
    delete S.settings().sitePerms['127.0.0.1']
    ok('a camera and microphone not asked yet are not reported as blocked (Meet would never ask)', await wcP.executeJavaScript("Promise.all(['camera', 'microphone'].map(n => navigator.permissions.query({ name: n }).then(p => p.state)))").then(r => r.join()) === 'granted,granted')
    dialog.showMessageBox = async (_, o) => { asked.push(o.message); return { response: 0, checkboxChecked: false } } // a mailto: link asks before opening the mail app (blocked here)
    await wcP.executeJavaScript("location.href = 'mailto:a@b.c'", true); await sleep(600)
    ok('a mailto: link asks before opening another app', /127.0.0.1 wants to open mailto: links in another app/.test(asked.at(-1)), asked.at(-1))
    const nAsked = asked.length; await wcP.executeJavaScript("location.href = 'file:///C:/Windows/notepad.exe'", true); await sleep(600)
    ok('a file: link is never handed over', asked.length === nAsked)
    // devices (USB, serial), a page that refuses to close, a crashed tab, a password-protected page
    dialog.showMessageBox = async (_, o) => { asked.push(o.message); return { response: 0, checkboxChecked: false } }
    const nDev = asked.length
    wcP.executeJavaScript("void navigator.usb.requestDevice({ filters: [] }).catch(() => {})", true); await sleep(1500) // not awaited: with no chooser the request would wait forever
    ok('a USB device request opens the picker', /wants to connect to a USB device/.test(asked[nDev] || ''), asked[nDev])
    wcP.executeJavaScript("void navigator.serial.requestPort().catch(() => {})", true); await sleep(1500)
    ok('and so does a serial port request', /wants to connect to a serial device/.test(asked.at(-1)), asked.at(-1))
    const { dialog: dlg } = require('electron'), realSync = dlg.showMessageBoxSync; let answer = 1
    dlg.showMessageBoxSync = () => answer
    await wcP.executeJavaScript("addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = '' }); 1", true)
    S.userClose(pp.id); await sleep(1200)
    ok('a page that asks "Leave site?" stays open when the user says Stay', !!a.tabs().find(t => t.id === pp.id))
    answer = 0; S.userClose(pp.id); await sleep(1200)
    ok('and closes when the user says Leave', !a.tabs().find(t => t.id === pp.id))
    dlg.showMessageBoxSync = realSync
    const cr = await open('/'); cr.view.webContents.forcefullyCrashRenderer(); await sleep(1500)
    ok('a crashed tab says so, on a screen of its own with a way out', /crashed/.test(cr.error || '') && cr.title === 'This tab crashed' && await js(cr.view.webContents, `[...document.querySelectorAll('.acts button')].map(b => b.textContent).join()`) === 'Reload tab', cr.error + ' | ' + cr.title)
    await js(cr.view.webContents, `document.querySelector('.acts .primary').click()`); await sleep(1500)
    ok('and reloading brings the page back', cr.title !== 'This tab crashed' && !cr.error, cr.title + ' | ' + cr.error); a.closeTab(cr.id)
    const sec = a.newTab(base + '/secret'); await sleep(1500)
    ok('a password-protected page asks for a sign-in', S.authCurrent()?.info?.realm === 'Test area', JSON.stringify(S.authCurrent()?.info))
    ok('the sign-in window explains who is asking', /Test area/.test(await S.authCurrent().w.contentView.children[0].webContents.executeJavaScript("document.querySelector('#why').textContent")))
    S.authCurrent().finish({ user: 'mike', pass: 'pw' }); await sleep(1500)
    ok('and the page opens once signed in', /Welcome/.test(sec.title || ''), sec.title); a.closeTab(sec.id)
    // an invalid certificate: a warning first, the page only if the user insists (skipped where openssl is missing)
    const key = path.join(os.tmpdir(), 'heliarc-test.key'), crt = path.join(os.tmpdir(), 'heliarc-test.crt')
    if (require('child_process').spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=localhost']).status === 0) {
      const tls = require('https').createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(crt) }, (q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<title>Secure page</title>ok') })
      await new Promise(r => tls.listen(0, r)); const url = 'https://localhost:' + tls.address().port + '/'; let pick = 1
      const bad = a.newTab(url); await sleep(2500)
      ok('an invalid certificate shows a warning screen and the page stays closed', /localhost isn’t private/.test(bad.title) && bad.title !== 'Secure page' && !!bad.error && bad.url === url, bad.title + ' | ' + bad.error + ' | ' + bad.url)
      ok('with a safe way out first and the risky one marked', await js(bad.view.webContents, `[...document.querySelectorAll('.acts button')].map(b => (b.classList.contains('primary') ? 'primary' : b.classList.contains('danger') ? 'danger' : '') + ':' + b.textContent).join('|')`) === 'primary:Go back to safety|danger:Continue anyway (unsafe)')
      await js(bad.view.webContents, `document.querySelector('.acts .danger').click()`); await sleep(2500)
      ok('and opens once the user continues anyway', bad.title === 'Secure page' && S.trustedCerts.has('localhost'), bad.title); a.closeTab(bad.id); S.trustedCerts.clear()
      S.openPeek(url.replace('localhost', '127.0.0.1')); await sleep(2500)
      ok('an invalid certificate in Peek shows the warning screen too, without a box', /isn’t private/.test(S.peek()?.view.webContents.getTitle() || ''), S.peek()?.view.webContents.getTitle()); S.closePeek(); tls.close()
    }
    dialog.showMessageBox = realBox
    // pages that can't load: one screen with a clear cause and a way out, in the tab
    const closedPort = await new Promise(r => { const srv = require('net').createServer().listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => r(p)) }) }) // a port nobody listens on
    const closedUrl = 'http://127.0.0.1:' + closedPort + '/', refused = a.newTab(closedUrl); await sleep(2500)
    ok('a site that refuses the connection says so', refused.title === '127.0.0.1 refused to connect' && !!refused.error && refused.url === closedUrl, refused.title + ' | ' + refused.error + ' | ' + refused.url + ' | ' + refused.sys?.detail)
    ok('and offers Try again, with the technical details folded away', await js(refused.view.webContents, `document.querySelector('.acts .primary').textContent + '|' + document.querySelector('details').open`) === 'Try again|false')
    await js(refused.view.webContents, `document.querySelector('.acts .primary').click(); document.querySelector('.acts .primary').textContent`); await sleep(2000)
    ok('trying again that fails again says so instead of looking frozen', await js(refused.view.webContents, `!document.getElementById('again').hidden && /Still not working/.test(document.getElementById('again').textContent)`))
    a.closeTab(refused.id)
    S.openPeek(closedUrl); await sleep(2500)
    ok('a link opened in Peek that fails gets the same screen', S.peek()?.sys?.kind === 'refused' && S.peek().view.webContents.getTitle() === '127.0.0.1 refused to connect', S.peek()?.view.webContents.getTitle())
    S.closePeek()
    S.openExternal(closedUrl); await sleep(2500)
    ok('and so does the Little window, which keeps the real address for "Open in a tab"', S.little()?.sys?.kind === 'refused' && S.little().view.webContents.getTitle() === '127.0.0.1 refused to connect' && S.realUrl?.(S.little().view.webContents, S.little()) === closedUrl, S.little()?.view.webContents.getTitle())
    S.little()?.win.close(); await sleep(500)
    const gone = a.newTab('http://no-such-host.invalid/'); await sleep(4000)
    ok('an address that does not exist says so (or says offline when there is no network)', /^We can’t find no-such-host.invalid$|^You’re offline$/.test(gone.title), gone.title); a.closeTab(gone.id)
    const off = a.newTab(S.SYSTEM + '#' + encodeURIComponent(JSON.stringify({ kind: 'offline', url: base + '/', host: '127.0.0.1', tries: 1 }))); await sleep(1500)
    ok('the offline screen reloads the page by itself when the connection is back', off.title === 'You’re offline')
    ok('the offline screen is the Red Room of the Black Lodge, drawn in two colours', await js(off.view.webContents, `new Promise(r => setTimeout(() => { const i = document.getElementById('lodge'); if (!i || !i.naturalWidth) return r('no picture'); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let k = 0; k < d.length; k += 4) seen.add(d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ',' + d[k + 3]); r(c.width + 'x' + c.height + ' ' + seen.size) }, 800))`) === '512x384 2', 'the picture of the offline screen')
    const dance = await js(off.view.webContents, `new Promise(r => { const i = document.getElementById('lodge'), still = i.src, seen = new Set(); dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); const t = setInterval(() => seen.add(i.src.length), 60); setTimeout(() => { clearInterval(t); r(JSON.stringify([seen.size >= 6, i.src === still])) }, 800); setTimeout(() => r('late'), 6000) })`)
    ok('Space makes the Man from Another Place dance in the room (many different pictures)', dance === '[true,false]', dance)
    await sleep(3000)
    ok('and when the dance is over the room is back as it was', await js(off.view.webContents, `!!document.getElementById('lodge').src`))
    await js(off.view.webContents, `dispatchEvent(new Event('online'))`); await sleep(2000)
    ok('and it did', off.title !== 'You’re offline' && off.url.startsWith(base), off.title + ' | ' + off.url); a.closeTab(off.id)
    // a page that stops responding: a card over the tab, not a native box
    const hang = await open('/'); a.activate(hang.id); await sleep(300)
    hang.view.webContents.emit('unresponsive'); await sleep(500)
    ok('a page that stops responding gets a card over the tab', S.hungTab() === hang && S.hungUi().getVisible() && JSON.stringify(S.hungUi().getBounds()) === JSON.stringify(hang.view.getBounds()))
    await js(S.hungUi().webContents, `document.getElementById('wait').click()`); await sleep(400)
    ok('Wait puts it away', S.hungTab() === null && !S.hungUi().getVisible())
    hang.view.webContents.emit('unresponsive'); await sleep(300); hang.view.webContents.emit('responsive'); await sleep(300)
    ok('and it goes away by itself when the page answers again', S.hungTab() === null && !S.hungUi().getVisible()); a.closeTab(hang.id)
    // a download that fails says so and can be started again
    let hits = 0, cutting = true; const flaky = require('http').createServer((q, r) => { hits++; r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': 100000, 'Content-Disposition': 'attachment; filename="flaky.bin"' }); cutting ? (r.write(Buffer.alloc(1000)), setTimeout(() => r.destroy(), 100)) : r.end(Buffer.alloc(100000)) })
    await new Promise(r => flaky.listen(0, '127.0.0.1', r)); const dlHost = await open('/'); a.activate(dlHost.id); await sleep(300)
    dlHost.view.webContents.downloadURL('http://127.0.0.1:' + flaky.address().port + '/flaky.bin'); await until(async () => S.downloads().some(d => d.name === 'flaky.bin' && d.state === 'interrupted'), 20000)
    const failedDl = S.downloads().find(d => d.name === 'flaky.bin'); await sleep(500)
    ok('a failed download is marked failed', failedDl?.state === 'interrupted', JSON.stringify(failedDl))
    ok('and the sidebar says so with a Retry button', /Download failed/.test(await js(ui(), "document.querySelector('#dl').innerText")) && await js(ui(), "!!document.querySelector('#dl [data-dl=retry]')"))
    cutting = false; await js(ui(), "document.querySelector('#dl [data-dl=retry]').click()"); await until(async () => S.downloads().some(d => d.name.startsWith('flaky') && d.state === 'completed'), 10000)
    ok('Retry downloads it again and the failed entry is gone', S.downloads().filter(d => d.name.startsWith('flaky')).length === 1, JSON.stringify(S.downloads().map(d => d.name + ':' + d.state)))
    for (const d of S.downloads().filter(x => x.name.startsWith('flaky'))) { await js(ui(), `api.call('delDownload', ${d.id})`); fs.rmSync(d.path, { force: true }) }
    flaky.close(); a.closeTab(dlHost.id)
    // design system: tokens, components and the guard that keeps hard-coded values out of migrated screens
    const dsRun = require('child_process').spawnSync(process.execPath, ['scripts/ds-check.js'], { cwd: __dirname, encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
    ok('the design-system guard passes (token contrast, no hand-written colours or sizes in migrated screens)', dsRun.status === 0, dsRun.stderr + dsRun.stdout)
    { // the guard really fails when a screen writes a colour, a font size or a radius by hand
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heliarc-ds-')); for (const f of fs.readdirSync(path.join(__dirname, 'ui')).filter(x => /\.(html|css)$/.test(x))) fs.copyFileSync(path.join(__dirname, 'ui', f), path.join(tmp, f))
      fs.appendFileSync(path.join(tmp, 'hung.html'), '<style>b { color: #ff0000; font-size: 13px; border-radius: 7px }</style>')
      const bad = require('child_process').spawnSync(process.execPath, ['scripts/ds-check.js'], { cwd: __dirname, encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DS_UI: tmp } })
      ok('and it fails when a migrated screen writes a colour, a font size or a radius by hand', bad.status === 1 && /#ff0000/.test(bad.stderr) && /font-size: 13px/.test(bad.stderr) && /border-radius: 7px/.test(bad.stderr), bad.stderr)
      fs.rmSync(tmp, { recursive: true, force: true })
    }
    const dsTab = a.newTab(require('url').pathToFileURL(path.join(__dirname, 'ui', 'design-system.html')).href); await sleep(1500)
    const dsWc = dsTab.view.webContents, pageBg = () => dsWc.executeJavaScript("getComputedStyle(document.body).backgroundColor")
    const ntWc = a.newTab(''); await sleep(1500); await until(async () => /New tab/.test(ntWc.title) || ntWc.view)
    ok('the new tab page is styled by the design system (dark background, not the browser default)', await until(async () => js(ntWc.view.webContents, "getComputedStyle(document.body).backgroundColor === 'rgb(22, 22, 26)'")), await js(ntWc.view.webContents, 'getComputedStyle(document.body).backgroundColor')); a.closeTab(ntWc.id)
    ok('the showcase page shows every colour token and every component', await dsWc.executeJavaScript("[document.querySelectorAll('#colours .sw').length, document.querySelectorAll('.ds-btn').length >= 8, !!document.querySelector('.ds-field.is-error'), !!document.querySelector('.ds-check input:checked'), !!document.querySelector('.ds-modal')].join()") === '12,true,true,true,true')
    await dsWc.executeJavaScript("document.documentElement.dataset.theme = 'light'"); const light = await pageBg()
    await dsWc.executeJavaScript("document.documentElement.dataset.theme = 'dark'"); const dark = await pageBg()
    await dsWc.executeJavaScript("document.documentElement.dataset.theme = 'dark'"); dsWc.focus(); dsWc.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); dsWc.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' }); await sleep(300)
    ok('a select has its own chevron with room on its right', await dsWc.executeJavaScript("(() => { const c = getComputedStyle(document.querySelector('.ds-select')); return c.appearance === 'none' && parseFloat(c.paddingRight) >= 30 && c.backgroundImage.includes('svg+xml') })()"))
    ok('keyboard focus is visible on a component (a solid 2px ring)', await dsWc.executeJavaScript("(() => { const e = document.activeElement, c = getComputedStyle(e); return [e.tagName, c.outlineStyle, c.outlineWidth].join() })()") === 'BUTTON,solid,2px')
    ok('and follows the light and the dark theme', light === 'rgb(244, 244, 248)' && dark === 'rgb(22, 22, 26)', light + ' | ' + dark); a.closeTab(dsTab.id)
    // private space: nothing is kept
    const PV = 3, pses = S.spaceSessions()[PV], histBefore = S.history().length
    const pt = await open('/cookie', PV); const pt2 = await open('/private-page', PV)
    ok('the private space stores its cookies in memory only', (await pses.cookies.get({ name: 'who' })).length === 1 && !require('electron').session.fromPartition('private').storagePath)
    ok('private tabs are not saved with the session', S.snapshot().tabs.every(t => t.space !== PV))
    ok('private pages never reach the history', S.history().length === histBefore && !S.history().some(h => h.url.endsWith('/private-page')))
    pt2.view.webContents.downloadURL(base + '/file.bin'); await until(async () => S.downloads().some(d => d.private && d.state === 'completed'), 10000)
    require('./lib/store').flushAll(); const onDisk = () => { try { return JSON.parse(fs.readFileSync(path.join(require('electron').app.getPath('userData'), 'downloads.json'), 'utf8')) } catch { return [] } }
    ok('a download made in the private space is listed but never written to disk', S.downloads().some(d => d.private) && !onDisk().some(d => d.private), JSON.stringify(onDisk().map(d => d.name)))
    await js(ui(), "api.call('move', " + pt2.id + ", 'fav')"); await sleep(300)
    ok('a private tab cannot be made a favorite', !pt2.fav)
    a.switchSpace(0); await sleep(400)
    ok('the command bar and sidebar are not told about private tabs while another space is open', !(await js(ui(), 'state.tabs.some(t => t.space === ' + PV + ')')))
    ok('the library is not told about private downloads while another space is open', !(await js(ui(), 'state.downloads.some(d => d.private)')))
    a.closeTab(pt.id); await sleep(300); ok('closing one private tab keeps the session', (await pses.cookies.get({ name: 'who' })).length === 1)
    a.closeTab(pt2.id); await sleep(800)
    ok('closing the last private tab wipes everything and goes home', (await pses.cookies.get({ name: 'who' })).length === 0 && S.space() === 0 && !S.downloads().some(d => d.private))
    a.switchSpace(0)
    // importing from other browsers: build the same files they write, read them back
    { const I = require('./lib/importers'), { DatabaseSync } = require('node:sqlite'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heliarc-imp-')), db = (n, sql) => { const f = path.join(dir, n), d = new DatabaseSync(f); d.exec(sql); d.close(); return f }
      const t0 = Date.now() - 60000
      const chrome = db('History', `create table urls(id integer primary key, url text, title text, last_visit_time integer); insert into urls(url, title, last_visit_time) values ('https://c.example/', 'Chrome page', ${(t0 + 11644473600000) * 1000}), ('chrome://settings', 'skip', 5)`)
      const ch = I.history('chrome', chrome); ok('Chrome history is read (web pages only, real dates)', ch.length === 1 && ch[0].url === 'https://c.example/' && Math.abs(ch[0].at - t0) < 2000, JSON.stringify(ch))
      const ff = db('places.sqlite', `create table moz_places(id integer primary key, url text, title text, last_visit_date integer); create table moz_bookmarks(id integer primary key, parent integer, type integer, fk integer, title text);
        insert into moz_places values (1, 'https://f.example/', 'Fox page', ${t0 * 1000}), (2, 'https://g.example/', 'Loose', null);
        insert into moz_bookmarks values (1, 0, 2, null, ''), (3, 1, 2, null, 'toolbar'), (10, 3, 2, null, 'Reading'), (11, 10, 1, 1, 'Fox page'), (12, 3, 1, 2, 'Loose')`)
      const fh = I.history('firefox', ff), fb = I.bookmarks('firefox', ff)
      ok('Firefox history is read', fh.length === 1 && Math.abs(fh[0].at - t0) < 2000, JSON.stringify(fh))
      ok('Firefox bookmarks keep their folder', fb.find(b => b.url === 'https://f.example/')?.folder === 'Reading' && fb.find(b => b.url === 'https://g.example/')?.folder === '', JSON.stringify(fb))
      const saf = db('History.db', `create table history_items(id integer primary key, url text); create table history_visits(id integer primary key, history_item integer, title text, visit_time real); insert into history_items values (1, 'https://s.example/'); insert into history_visits values (1, 1, 'Safari page', ${(t0 / 1000) - 978307200})`)
      // saved passwords of the Chromium browsers: built the way Chrome writes them (Mac: AES-CBC, Windows: AES-GCM), read back with the same keys
      { const cr = require('crypto'), hex = b => "x'" + Buffer.from(b).toString('hex') + "'"
        const encMac = (txt, key) => { const c = cr.createCipheriv('aes-128-cbc', key, Buffer.alloc(16, 0x20)); return Buffer.concat([Buffer.from('v10'), c.update(txt, 'utf8'), c.final()]) }
        const encWin = (txt, key) => { const n = cr.randomBytes(12), c = cr.createCipheriv('aes-256-gcm', key, n); return Buffer.concat([Buffer.from('v10'), n, c.update(txt, 'utf8'), c.final(), c.getAuthTag()]) }
        for (const [label, mac, key, enc] of [['Mac', true, I.macKey('keychain secret'), encMac], ['Windows', false, cr.randomBytes(32), encWin]]) {
          const ld = db('Login Data ' + label, `create table logins(origin_url text, username_value text, password_value blob, blacklisted_by_user integer);
            insert into logins values ('https://site.example/login', 'mike', ${hex(enc('p@ss wörd', key))}, 0), ('https://other.example/', '', ${hex(enc('second', key))}, 0),
            ('https://never.example/', 'x', ${hex(enc('never saved', key))}, 1), ('chrome://settings', 'y', ${hex(enc('internal', key))}, 0), ('https://new.example/', 'z', ${hex(Buffer.concat([Buffer.from('v20'), Buffer.alloc(40, 1)]))}, 0), ('android://app', 'a', ${hex(Buffer.from('v20xxxx'))}, 0), ('https://broken.example/', 'b', ${hex(Buffer.from('v10abc'))}, 0), ('https://legacy.example/', 'c', ${hex(Buffer.from('legacyblob'))}, 0)`)
          const r = I.chromiumLogins(ld, key, mac)
          ok(label + ' browser passwords are decrypted (never-saved sites and internal pages left out)', r.list.length === 2 && r.list[0].origin === 'https://site.example' && r.list[0].user === 'mike' && r.list[0].pass === 'p@ss wörd' && r.list[1].pass === 'second', JSON.stringify(r.list))
          ok(label + ': passwords only the browser itself can read are counted, not guessed', r.skipped === 1 && r.failed === 2, 'skipped ' + r.skipped + ' failed ' + r.failed + ' (a non-web origin is ignored; only v20 is "browser only": a v10 row that does not decrypt and an unprefixed row are failures)') } }
      const sh = I.history('safari', saf); ok('Safari history is read', sh.length === 1 && Math.abs(sh[0].at - t0) < 2000, JSON.stringify(sh))
      const cb = path.join(dir, 'Bookmarks'); fs.writeFileSync(cb, JSON.stringify({ roots: { bookmark_bar: { type: 'folder', children: [{ type: 'url', name: 'Top', url: 'https://t.example/' }, { type: 'folder', name: 'Work', children: [{ type: 'url', name: 'Deep', url: 'https://d.example/' }, { type: 'folder', name: 'Inner', children: [{ type: 'url', name: 'Deeper', url: 'https://dd.example/' }] }] }] } } }))
      const cbm = I.bookmarks('chrome', cb); ok('Chrome bookmarks keep their top folder', cbm.length === 3 && cbm.find(b => b.url === 'https://dd.example/').folder === 'Work' && cbm.find(b => b.url === 'https://t.example/').folder === '', JSON.stringify(cbm))
      const hb = path.join(dir, 'b.html'); fs.writeFileSync(hb, '<DL><p><DT><H3>Bar</H3><DL><p><DT><A HREF="https://a.example/">A</A><DT><H3>Dev</H3><DL><p><DT><A HREF="https://b.example/">B</A></DL><p></DL><p></DL>')
      ok('exported bookmarks files (HTML) are read', JSON.stringify(I.bookmarks('file', hb).map(b => b.folder)) === '["","Dev"]')
      const pw = I.passwords('name,url,username,password,note\nGitHub,https://github.com/login,me@x.com,pw1,\nBad,nope,u,p,\n'), pw2 = I.passwords('Title,URL,Username,Password,Notes,OTPAuth\nApple,https://appleid.apple.com/,a@b.c,"p,w",,')
      ok('passwords CSV from Chrome and Safari are read', pw.length === 1 && pw[0].origin === 'https://github.com' && pw2.length === 1 && pw2[0].pass === 'p,w', JSON.stringify([pw, pw2]))
      { const v0 = S.vault().length, row = (user, pass) => ({ origin: 'https://bulk.example', user, pass }), b1 = S.addPasswords([row('a', '1'), row('a', '1'), row('b', '2')]), b2 = S.addPasswords([row('a', '3'), row('b', '2')])
        ok('an imported passwords list adds new rows once, updates changed ones, and skips identical ones', /Imported 2 /.test(b1.text) && /Imported 1 /.test(b2.text) && S.vault().length === v0 + 2, b1.text + ' / ' + b2.text)
        for (let i = S.vault().length - 1; i >= 0; i--) if (S.vault()[i].origin === 'https://bulk.example') S.vault().splice(i, 1) }
      const before = S.history().length; const r1 = S.addHistory([...ch, ...fh]); const r2 = S.addHistory(ch)
      ok('imported history is merged without duplicates', S.history().length === before + 2 && /Imported 0/.test(r2.text), r1.text + ' / ' + r2.text)
      const nf = S.folders().length, nt = a.tabs().length; S.addBookmarks(cbm, 'Chrome')
      ok('imported bookmarks become folders of sleeping tabs', S.folders().length === nf + 2 && a.tabs().length === nt + 3 && a.tabs().slice(-3).every(t => t.asleep && !t.view), S.folders().length + ' folders')
      S.folders().filter(f => /Chrome|Imported/.test(f.name)).forEach(f => S.delFolder(f.id)); for (const t of [...a.tabs()].filter(t => /\.example\//.test(t.url) && t.asleep)) a.closeTab(t.id)
      fs.rmSync(dir, { recursive: true, force: true }) }
    // update check against a fake GitHub
    { const U = require('./lib/updates'), real = global.fetch, release = tag => { global.fetch = async () => ({ ok: true, json: async () => ({ tag_name: tag, html_url: 'https://example.com/release' }) }) }
      release('v99.0.0'); const up = await U.check('0.2.4'); release('v0.2.4'); const same = await U.check('0.2.4'); release('nightly'); const odd = await U.check('0.2.4')
      ok('a newer release is detected', up?.version === '99.0.0' && up.url === 'https://example.com/release' && same === null && odd === null, JSON.stringify([up, same, odd]))
      release('v99.0.0'); const res = await S.checkUpdate(); await sleep(400)
      ok('the sidebar offers the new version', /99.0.0 is available/.test(res.text) && /99.0.0/.test(await js(ui(), "document.querySelector('#upd').textContent")), JSON.stringify(res))
      global.fetch = real
      // the downloader (Mac): a fake one walks through its states
      const { EventEmitter } = require('events'), AU = require('./lib/autoupdate'), seen = []
      const fake = Object.assign(new EventEmitter(), { feed: null, checks: 0, installed: false, setFeedURL(o) { this.feed = o.url }, checkForUpdates() { this.checks++ }, quitAndInstall() { this.installed = true } })
      const au = AU.setup({ autoUpdater: fake, feed: 'https://example.com/feed', onChange: s => seen.push(s) })
      fake.emit('update-available'); fake.emit('update-downloaded', {}, 'notes', 'Heliarc 9'); fake.emit('error', new Error('boom')); fake.emit('update-not-available'); au.check(); au.install()
      ok('the update downloader reports its states', fake.feed === 'https://example.com/feed' && JSON.stringify(seen) === '[{"state":"downloading"},{"state":"ready","name":"Heliarc 9"},{"state":"error","error":"boom"},null]' && fake.checks === 1 && fake.installed, JSON.stringify(seen))
      const hit = au.check(); fake.emit('update-available'); const miss = au.check(); fake.emit('update-not-available')
      ok('a check says whether a download started', await hit === true && await miss === false)
      S.setUpdater({ state: 'downloading' }); await sleep(300)
      ok('the sidebar shows the download', /Downloading/.test(await js(ui(), "document.querySelector('#upd').textContent")))
      S.setUpdater({ state: 'ready' }); await sleep(300)
      ok('and offers to restart once it is downloaded', /Restart/.test(await js(ui(), "document.querySelector('#upd').textContent")))
      S.setUpdater(null) }
    // spell check suggestions in the right-click menu
    { const { Menu: M } = require('electron'), build = M.buildFromTemplate; let tpl = null; M.buildFromTemplate = t => { tpl ??= t; const x = build(t); x.popup = () => {}; return x }
      const sp = await open('/'); S.pageMenu(sp.view.webContents, { misspelledWord: 'teh', dictionarySuggestions: ['the', 'tea'], x: 1, y: 1 })
      ok('right-click on a misspelled word offers suggestions and "add to dictionary"', tpl?.[0]?.label === 'the' && tpl[1]?.label === 'tea' && /Add “teh”/.test(tpl[2]?.label), JSON.stringify(tpl?.slice(0, 4).map(i => i.label)))
      M.buildFromTemplate = build; a.closeTab(sp.id) }
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
    S.setRoute('localhost', 2); a.switchSpace(0); const here = await open('/'); const nTabs = a.tabs().length
    a.go('http://localhost:' + base.split(':')[2] + '/second'); await sleep(600)
    ok('a typed address to a routed site opens in that site’s space', a.tabs().length === nTabs + 1 && a.tabs().at(-1).space === 2 && here.url === base + '/', 'tabs ' + nTabs + '→' + a.tabs().length + ' space ' + a.tabs().at(-1).space)
    { a.switchSpace(0); const pin = await open('/', 0); a.pin(pin.id); const n = a.tabs().length; a.go('http://localhost:' + base.split(':')[2] + '/second'); await sleep(600)
      ok('a typed address in a pinned tab navigates in place, whatever its route', a.tabs().length === n && /localhost/.test(pin.url) && pin.space === 0, 'tabs ' + n + '→' + a.tabs().length + ' space ' + pin.space + ' ' + pin.url) }
    { a.switchSpace(0); const blank = a.newTab(), n = a.tabs().length, fo = S.newFolder(); S.place(blank.id, 'folder', fo); a.go('http://localhost:' + base.split(':')[2] + '/second'); await sleep(600)
      ok('a typed routed address on a blank tab moves that tab instead of leaving it empty', a.tabs().length === n && blank.space === 2 && /localhost/.test(blank.url) && S.space() === 2, 'tabs ' + n + '→' + a.tabs().length + ' space ' + blank.space + ' ' + blank.url)
      ok('and the tab leaves the folder of its old space', blank.folder === null, 'folder=' + blank.folder); S.delFolder(fo); a.closeTab(blank.id) }
    S.settings().routes = []; a.switchSpace(0)
    // peek
    const t = await open('/'); S.openPeek(base + '/second'); await until(async () => S.peek() && !S.peek().view.webContents.isLoading() && S.peek().view.webContents.getTitle() === 'Second page')
    ok('peek opens a floating page', !!S.peek() && S.peek().view.webContents.getTitle() === 'Second page')
    ok('peek is hardened like a tab (WebRTC, fingerprint)', S.peek().view.webContents.getWebRTCIPHandlingPolicy() === 'default_public_interface_only' && await js(S.peek().view.webContents, 'navigator.hardwareConcurrency === 4'))
    S.openPeek(base + '/login'); await until(async () => S.peek() && S.peek().view.webContents.getTitle() === 'Login'); await sleep(500)
    { const pwc = S.peek().view.webContents, p = await js(pwc, "(() => { const b = document.querySelector('#u').getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()")
      pwc.focus(); pwc.sendInputEvent({ type: 'mouseMove', ...p }); pwc.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 }); pwc.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 }); await sleep(900)
      ok('a saved password fills in peek too', S.vault().length > 0 && await js(pwc, "document.getElementById('u').value") === 'michael', await js(pwc, "document.getElementById('u').value")) }
    S.openPeek(base + '/second'); await until(async () => S.peek() && S.peek().view.webContents.getTitle() === 'Second page')
    await sleep(500); await snap(S.peekUi(), 'peek-ui'); await snap(S.peek().view, 'peek-page')
    ok('peek is centered over the page', (() => { const b = S.peek().view.getBounds(), c = S.content(); return b.x > c.x && b.y > c.y && b.x + b.width < c.x + c.w })())
    S.openPeek(base + '/darktop'); await sleep(1500)
    ok('the peek top bar takes the colour of the top of the page', await js(S.peekUi().webContents, "getComputedStyle(document.querySelector('#bar')).backgroundColor") === 'rgb(17, 34, 51)', await js(S.peekUi().webContents, "getComputedStyle(document.querySelector('#bar')).backgroundColor"))
    ok('and the corners behind the page share that colour', await js(S.peekUi().webContents, "getComputedStyle(document.querySelector('#card')).backgroundColor") === 'rgb(17, 34, 51)')
    S.openPeek(base + '/second'); await sleep(800)
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
    ok('the little window is hardened like a tab (WebRTC, fingerprint)', S.little().view.webContents.getWebRTCIPHandlingPolicy() === 'default_public_interface_only' && await js(S.little().view.webContents, 'navigator.hardwareConcurrency === 4'))
    await sleep(500); await snap(S.little().bar, 'little-bar')
    const nn = a.tabs().length, lv = S.little().view.webContents, lb = S.little().bar.webContents
    await js(lb, `document.querySelector('#mv').click()`); await sleep(800)
    ok('little window moves the page to the main window', S.little() === null && a.tabs().length === nn + 1 && a.cur().url === base + '/second')
    ok('closed little window frees its pages', lv.isDestroyed() && lb.isDestroyed())
    { const MOD = process.platform === 'darwin' ? 'meta' : 'control'
      S.openExternal(base + '/second'); await until(async () => S.little() && S.little().view.webContents.getTitle() === 'Second page'); const lw = S.little().view.webContents
      lw.setZoomLevel(1); lw.focus(); lw.sendInputEvent({ type: 'keyDown', keyCode: '0', modifiers: [MOD] }); await sleep(400)
      ok('shortcuts work in the little window (actual size)', lw.getZoomLevel() === 0, String(lw.getZoomLevel()))
      lw.sendInputEvent({ type: 'keyDown', keyCode: 'W', modifiers: [MOD] }); await sleep(700)
      ok('and so does close', S.little() === null) }
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
    ok('a normal page stays at 100%', await sleep(1200).then(() => t.view.webContents.getZoomFactor() === 1))
    const ww = t.view.webContents, vw = () => t.view.getBounds().width; await ww.loadURL(base + '/wide')
    ok('a page wider than the window is shrunk to fit', await until(async () => ww.getZoomFactor() < 1) && Math.abs(ww.getZoomFactor() - Math.floor(vw() / 1200 * 100) / 100) < .011, `zoom=${ww.getZoomFactor()} view=${vw()}`)
    ok('no sideways scroll left', await js(ww, 'document.documentElement.scrollWidth <= innerWidth + 1'))
    S.zoom(1); const manual = ww.getZoomFactor(); await sleep(900); ok('manual zoom wins over the fit', ww.getZoomFactor() === manual, `${manual} → ${ww.getZoomFactor()}`)
    S.zoom(0); ok('Ctrl+0 fits the page again', await until(async () => ww.getZoomFactor() < 1))
    await ww.loadURL(base + '/'); ok('fit is dropped on the next page', await until(async () => ww.getZoomFactor() === 1))
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
    const fits = async () => (await js(t.view.webContents, 'innerWidth')) === t.view.getBounds().width
    ok('page layout matches the view width after the sidebar returns', await until(fits), `${await js(t.view.webContents, 'innerWidth')} vs ${t.view.getBounds().width}`)
    // the command palette sits in the middle of the page area, not of the whole window
    const cmdCenter = async () => { a.openCmd('new'); await sleep(900); const r = await js(a.cmd().webContents, `(() => { const b = document.getElementById('box').getBoundingClientRect(); return { mid: b.x + b.width / 2, w: innerWidth } })()`); a.closeCmd(); await sleep(300); return r }
    const pageMid = () => { const b = t.view.getBounds(); return b.x + b.width / 2 }
    let cc = await cmdCenter(); ok('palette is centered over the page (sidebar open)', Math.abs(cc.mid - pageMid()) <= 2, `palette=${cc.mid} page=${pageMid()}`)
    S.toggleSidebar(); await sleep(300); cc = await cmdCenter(); ok('palette is centered over the page (sidebar collapsed)', Math.abs(cc.mid - pageMid()) <= 2, `palette=${cc.mid} page=${pageMid()}`); S.toggleSidebar(); await sleep(300)
    const key = (k, extra = {}) => { let prevented = false; S.shortcut({ preventDefault: () => { prevented = true } }, { type: 'keyDown', key: k, control: process.platform !== 'darwin', meta: process.platform === 'darwin', alt: false, shift: false, ...extra }); return prevented }
    ok('Ctrl+F opens find', key('f') && S.findOpen()); S.closeFind()
    ok('Ctrl+S toggles the sidebar', key('s') && !S.sidebar()); key('s')
    ok('a plain key does nothing', !key('f', { control: false, meta: false }))
    // Mod+Shift+C copies the page address and the pill confirms it for a moment
    const cb = require('electron').clipboard; await cb.writeText('nothing yet'); const pill = () => js(a.ui().webContents, `document.querySelector('#pill').textContent`)
    ok('Mod+Shift+C is handled', key('c', { shift: true })); ok('it copies the address of the page', await until(async () => (await cb.readText()) === t.url), `${await cb.readText()} vs ${t.url}`)
    ok('the pill says the link was copied', await until(async () => /Link copied/.test(await pill()))); ok('and goes back to the site name', await until(async () => !/Link copied/.test(await pill()), 4000))
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
    const zip = zipSync({ 'manifest.json': Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Heliarc test extension', version: '1.2', host_permissions: ['https://*/*'], action: { default_popup: 'p.html' }, commands: { 'do-it': { description: 'Do it', suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' } } }, content_scripts: [{ matches: ['<all_urls>'], js: ['c.js'], run_at: 'document_start' }] })), 'c.js': Buffer.from(`document.documentElement.dataset.heliarcExt = 'on'`), 'p.html': Buffer.from('<title>popup ok</title><p>hi</p>') })
    const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
    const crx = Buffer.concat([Buffer.from('Cr24'), u32(3), u32(header.length), header, Buffer.from(zip)])
    const r = await S.ext.installCrx(crx, S.extSessions())
    ok('extension installs from a CRX package', r.name === 'Heliarc test extension' && r.version === '1.2', JSON.stringify(r))
    ok('extension keeps its Chrome Web Store id', r.id === S.ext.idOf(der), r.id)
    const attr = async t => js(t.view.webContents, `document.documentElement.dataset.heliarcExt || 'off'`)
    const home = await open('/'), work = await open('/', 1)
    ok('extension runs in the first space', await attr(home) === 'on'); ok('extension runs in every space', await attr(work) === 'on')
    a.switchSpace(0); await sleep(300); S.push()
    const { BrowserWindow, webContents } = require('electron'), router = S.crx.get(S.spaceSessions()[0]).ctx.router, sent = [], realSend = router.sendEvent
    router.sendEvent = (...a) => { a[1] === 'commands.onCommand' && sent.push(a.slice(0, 3)); return realSend.apply(router, a) }
    const mac = process.platform === 'darwin', press = k => S.extCommand({ preventDefault() {} }, { type: 'keyDown', key: k, control: !mac, meta: mac, alt: false, shift: true }, home)
    ok('an extension keyboard command runs from its suggested key', press('K') && sent.length === 1 && sent[0][2] === 'do-it', JSON.stringify(sent)); ok('other keys are left alone', !press('J') && sent.length === 1)
    router.sendEvent = realSend
    const actions = () => js(ui(), `document.querySelector('#exts').shadowRoot?.querySelectorAll('[part~=action]').length`)
    ok('extension shows in the sidebar toolbar', await until(async () => await actions() === 1), String(await actions()))
    await js(ui(), `document.querySelector('#exts').shadowRoot.querySelector('[part~=action]').click()`)
    const popup = () => webContents.getAllWebContents().find(w => w.getURL() === `chrome-extension://${r.id}/p.html`)
    ok('clicking it opens the extension popup', await until(async () => !!popup()), webContents.getAllWebContents().map(w => w.getURL()).join(' | '))
    ok('the popup page loads', await until(async () => popup()?.getTitle() === 'popup ok'))
    ok('a popup has no current tab, like in Chrome', await popup().executeJavaScript('chrome.tabs.getCurrent().then(t => t === undefined)'))
    ok('host permissions match by pattern', await popup().executeJavaScript("chrome.permissions.contains({ origins: ['https://account.example.com/*'] })"))
    ok('the browser alias carries the same APIs', await popup().executeJavaScript("typeof browser === 'undefined' || typeof browser.permissions?.contains === 'function'"))
    BrowserWindow.getAllWindows().forEach(w => w.webContents.getURL().startsWith('chrome-extension://') && w.close())
    // a package Chromium refuses reports an error, leaves no folder behind and keeps the installed version
    const bad = (m, extra = {}) => Buffer.concat([Buffer.from('Cr24'), u32(3), u32(header.length), header, Buffer.from(zipSync({ 'manifest.json': Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Broken', version: '2.0', content_scripts: [{ matches: [m], js: ['c.js'] }], ...extra })), 'c.js': Buffer.from('1') }))])
    const root = path.join(require('electron').app.getPath('userData'), 'extensions')
    const err = await S.ext.installCrx(bad('bogus'), S.extSessions()).then(() => null, e => e.message)
    ok('a broken extension reports an error', /install the extension/.test(err), err)
    // an installed extension that won't start is listed with a way to retry or remove it
    const brokenDir = path.join(root, 'brokenext'), writeManifest = patterns => { fs.mkdirSync(brokenDir, { recursive: true }); fs.writeFileSync(path.join(brokenDir, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Sleepy', version: '1', content_scripts: [{ matches: patterns, js: ['a.js'] }] })); fs.writeFileSync(path.join(brokenDir, 'a.js'), '') }
    writeManifest(['nope']); await S.ext.loadOne('brokenext', S.extSessions())
    ok('an extension that cannot start is remembered with its reason', S.ext.failures().some(x => x.id === 'brokenext' && x.name === 'Sleepy' && x.error), JSON.stringify(S.ext.failures()))
    ok('and the Extensions page lists it as failed', (await js(panel(), "api.call('extensions')")).some(x => x.id === 'brokenext' && x.failed))
    ok('retrying while it is still broken says so', (await js(panel(), "api.call('retryExtension', 'brokenext')")).ok === false)
    writeManifest(['https://example.com/*'])
    ok('and once fixed, retrying starts it', (await js(panel(), "api.call('retryExtension', 'brokenext')")).ok === true && !S.ext.failures().length)
    const started = S.ext.list(S.spaceSessions()[0]).find(x => x.name === 'Sleepy'); await S.ext.remove(started.id, S.extSessions()); fs.rmSync(brokenDir, { recursive: true, force: true }) // started under the id Chromium gave it
    ok('failed update keeps the working version', fs.readdirSync(root).filter(n => !n.startsWith('.')).join() === r.id && S.ext.list(S.spaceSessions()[0]).some(x => x.id === r.id && x.name === 'Heliarc test extension'), fs.readdirSync(root).join())
    ok('failed install leaves no leftovers', !fs.readdirSync(root).some(n => n.startsWith('.')), fs.readdirSync(root).join())
    // CRX2 packages keep the store id too
    const crx2 = Buffer.concat([Buffer.from('Cr24'), u32(2), u32(der.length), u32(4), der, Buffer.from('sig!'), Buffer.from(zip)])
    const r2 = await S.ext.installCrx(crx2, S.extSessions())
    ok('CRX2 package keeps its id and replaces the old copy', r2.id === S.ext.idOf(der) && fs.readdirSync(root).length === 1, JSON.stringify(r2))
    // like Bitwarden: a tiny content script asks the background worker, which injects the real scripts with chrome.scripting
    const der2 = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'der' })
    const header2 = Buffer.concat([pb(2, pb(1, der2)), pb(10000, pb(1, crypto.createHash('sha256').update(der2).digest().subarray(0, 16)))])
    const zip2 = zipSync({
      'manifest.json': Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Injector', version: '1', permissions: ['scripting', 'tabs', 'storage'], host_permissions: ['<all_urls>'], background: { service_worker: 'bg.js' }, content_scripts: [{ matches: ['<all_urls>'], js: ['t.js'], run_at: 'document_start', all_frames: true }] })),
      't.js': Buffer.from(`chrome.runtime.sendMessage({ hello: 1 }); chrome.runtime.sendMessage({ ask: 1 }).then(r => { document.documentElement.dataset.reply = JSON.stringify(r) }).catch(e => { document.documentElement.dataset.reply = 'ERR ' + e.message })`),
      'bg.js': Buffer.from(`chrome.scripting.registerContentScripts([{ id: 'reg', matches: ['<all_urls>'], js: ['reg.js'], runAt: 'document_start', allFrames: true, world: 'ISOLATED' }]).catch(e => chrome.scripting.executeScript({ target: { tabId: 0 }, func: () => 0 }).catch(() => {})); chrome.runtime.onMessage.addListener((m, s, send) => { if (m.ask) { setTimeout(() => send({ ok: 1 }), 50); return true } chrome.scripting.executeScript({ target: { tabId: s.tab.id, frameIds: [s.frameId ?? 0] }, files: ['inj.js'], injectImmediately: true, world: 'ISOLATED' }); chrome.windows.create({ url: chrome.runtime.getURL('w.html'), type: 'popup', width: 300, height: 300 }) }); chrome.storage.onChanged.addListener((c, a) => { if (c.ping) chrome.storage.session.set({ pong: [a, c.ping.newValue] }) })`),
      'w.html': Buffer.from('<title>popout ok</title><script src="w.js"></script>'),
      'w.js': Buffer.from(`setTimeout(() => chrome.storage.local.set({ ping: 7 }), 1500)`),
      'reg.js': Buffer.from(`document.documentElement.dataset.registered = 'yes'`),
      'inj.js': Buffer.from(`document.documentElement.dataset.injected = 'yes'`),
    })
    const r3 = await S.ext.installCrx(Buffer.concat([Buffer.from('Cr24'), u32(3), u32(header2.length), header2, Buffer.from(zip2)]), S.extSessions())
    await open('/second'); const inj = a.cur()
    ok('an extension worker can inject scripts into a page', await until(async () => await js(inj.view.webContents, `document.documentElement.dataset.injected`) === 'yes'), await js(inj.view.webContents, `document.documentElement.dataset.injected || 'no'`))
    ok('a worker can answer a page message asynchronously', await until(async () => (await js(inj.view.webContents, `document.documentElement.dataset.reply || ''`)).length > 0) && await js(inj.view.webContents, `document.documentElement.dataset.reply`) === '{"ok":1}', await js(inj.view.webContents, `document.documentElement.dataset.reply || 'none'`))
    ok('an extension can open a pop-out window', await until(async () => require('electron').webContents.getAllWebContents().some(w => w.getURL() === `chrome-extension://${r3.id}/w.html` && w.getTitle() === 'popout ok')))
    const pong = async () => { try { return await wpage()?.executeJavaScript(`chrome.storage.session.get('pong').then(o => JSON.stringify(o.pong || null))`) } catch (e) { return 'ERR ' + e.message.slice(0, 80) } }
    const wpage = () => require('electron').webContents.getAllWebContents().find(w => w.getURL() === `chrome-extension://${r3.id}/w.html`)
    ok('a worker hears storage changes made by an extension page', await until(async () => await pong() === '["local",7]'), await pong())
    require('electron').BaseWindow.getAllWindows().forEach(w => w.getTitle() === 'Heliarc' && w !== a.win() && w.close())
    await S.ext.remove(r3.id, S.extSessions())
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
    ok('settings show an icon catalogue and a name field for each space but the Private one', await js(panel(), `[document.querySelectorAll('.spedit').length, document.querySelectorAll('.spedit')[0].querySelectorAll('.ibtn').length, document.querySelector('.spedit input[data-f=name]').value].join()`) === '3,' + 50 + ',Home', 'got ' + await js(panel(), `document.querySelectorAll('.spedit').length + ',' + document.querySelectorAll('.ibtn.on').length`))
    ok('settings list shortcuts for this OS', await js(panel(), `[...document.querySelectorAll('.line')].find(l => l.innerText.startsWith('Split view')).querySelector('kbd').textContent`) === want.split)
    // macOS formatting, checked by running the page's own formatter with a Mac platform
    const pageScript = await js(blank.view.webContents, `document.querySelector('script').textContent`) // the page's CSP forbids new Function, so the script text is run from here
    const macText = await js(blank.view.webContents, `(() => { const el = { textContent: '' }; ((navigator, location, document) => { ${pageScript}
 })({ platform: 'MacIntel' }, { hash: '#Mod%2BShift%2BK' }, { getElementById: () => el }); return el.textContent })()`)
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

  await section('security: the app\'s own screens are locked down', async () => {
    const here = ui().getURL()
    ok('a screen of the app cannot open a window', await js(ui(), `window.open('https://example.com') === null`))
    await js(ui(), `location.href = 'https://example.com/'`).catch(() => {}); await sleep(800)
    ok('and cannot be sent away from the app\'s files', ui().getURL() === here, ui().getURL())
    ok('a screen of the app cannot run eval (content security policy)', await js(ui(), `new Promise(r => { const s = document.createElement('script'); s.textContent = 'window.__e = (() => { try { eval("1"); return "ran" } catch (e) { return "blocked" } })()'; document.head.append(s); r(window.__e) })`) === 'blocked')
    ok('and every screen of the app has that policy', fs.readdirSync(path.join(__dirname, 'ui')).filter(f => f.endsWith('.html')).every(f => fs.readFileSync(path.join(__dirname, 'ui', f), 'utf8').includes('Content-Security-Policy')))
  })

  server.close()
}
