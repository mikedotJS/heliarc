const http = require('http'), crypto = require('crypto')
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { z } = require('zod')
// Lets an AI assistant (Claude Code, Claude Desktop, Cursor…) drive Heliarc over MCP. Off by default; local only (127.0.0.1) and every request needs the secret token
// shown in Settings. The Private space is invisible here. `host` is what main.js lets the assistant do: tabs, spaces, and the page of a tab in front.
const PORT = 47821, MAX_BODY = 1 << 20, WAIT_LOAD = 15000

// what sends, pays, deletes or publishes: the in-app assistant asks the user before clicking it
const RISKY = /\b(pay|order|buy|purchase|checkout|delete|remove|erase|send|publish|post|submit|confirm|subscribe|donate|transfer|sign out|log out|payer|commander|acheter|valider|supprimer|envoyer|publier|confirmer|virement)\b/i // as written: it is also pasted into the page scripts
const ELEMENTS = `(() => {
  const shown = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const sel = e => { const p = []; for (; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) { if (e.id && document.querySelectorAll('#' + CSS.escape(e.id)).length === 1) { p.unshift('#' + CSS.escape(e.id)); break } let n = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) n++; p.unshift(e.tagName.toLowerCase() + ':nth-of-type(' + n + ')') } return p.join(' > ') }
  const els = [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[contenteditable=true]')].filter(shown).slice(0, 120)
  return { title: document.title, url: location.href, text: document.body.innerText, scrollY: Math.round(scrollY), scrollMax: document.documentElement.scrollHeight - innerHeight,
    elements: els.map(e => ({ selector: sel(e), tag: e.tagName.toLowerCase(), type: e.type || undefined, label: (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.title || '').trim().replace(/\\s+/g, ' ').slice(0, 80), href: e.href || undefined })) }
})()`
// where to click: the centre of the element, found by CSS selector or by its visible text (the exact match first)
const locate = (selector, text) => `(() => {
  const shown = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const label = e => (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.title || '').trim().replace(/\\s+/g, ' ')
  const selector = ${JSON.stringify(selector ?? null)}, text = ${JSON.stringify(text?.toLowerCase() ?? null)}
  let el
  try { el = selector ? document.querySelector(selector) : null } catch { return { error: 'Invalid selector' } }
  if (!el && text) { const all = [...document.querySelectorAll('a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[onclick]')].filter(shown); el = all.find(e => label(e).toLowerCase() === text) || all.find(e => label(e).toLowerCase().includes(text)) }
  if (!el) return { error: 'No element found' }
  el.scrollIntoView({ block: 'center', inline: 'center' }); el.focus?.()
  const r = el.getBoundingClientRect(); const name = label(el); return { label: name.slice(0, 60), sensitive: ${RISKY}.test(name), site: location.hostname, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), field: !!el.matches('input,textarea,[contenteditable=true]'), clear: el.select ? (el.select(), true) : false }
})()`

// a drop-down: found by CSS selector or by its label, then set to the option with that value or text (the exact one first), as if the user had picked it
const choose = (selector, text, option) => `(() => {
  const selector = ${JSON.stringify(selector ?? null)}, text = ${JSON.stringify(text?.toLowerCase() ?? null)}, option = ${JSON.stringify(option.toLowerCase())}
  const label = e => (e.getAttribute('aria-label') || [...(e.labels || [])].map(l => l.innerText).join(' ') || e.name || e.id || '').trim().replace(/\\s+/g, ' ').toLowerCase()
  let el
  try { el = selector ? document.querySelector(selector) : null } catch { return { error: 'Invalid selector' } }
  if (!el && text) { const all = [...document.querySelectorAll('select')]; el = all.find(e => label(e) === text) || all.find(e => label(e).includes(text)) }
  if (!el || el.tagName !== 'SELECT') return { error: 'No drop-down found' }
  const opts = [...el.options], pick = opts.find(o => o.value.toLowerCase() === option || o.text.trim().toLowerCase() === option) || opts.find(o => o.text.toLowerCase().includes(option))
  if (!pick || pick.disabled) return { error: 'No such option. Choose one of: ' + opts.filter(o => !o.disabled).map(o => o.text.trim()).join(' | ') }
  el.value = pick.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  return { chosen: pick.text.trim() }
})()`
// true once the text is on the page, or a visible element matches the selector
const present = (selector, text) => `(() => { try { return (${JSON.stringify(text ?? null)} === null || document.body.innerText.toLowerCase().includes(${JSON.stringify(text?.toLowerCase() ?? '')})) && (${JSON.stringify(selector ?? null)} === null || [...document.querySelectorAll(${JSON.stringify(selector ?? '')})].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })) } catch { return false } })()`

// the element that has the keyboard focus: would Enter on it send, pay or delete?
const focused = `(() => { const e = document.activeElement, name = (e?.getAttribute?.('aria-label') || e?.innerText || e?.value || '').trim().replace(/\\s+/g, ' ').slice(0, 60); return { label: name, sensitive: ${RISKY}.test(name), site: location.hostname } })()`
const text = s => ({ content: [{ type: 'text', text: typeof s === 'string' ? s : JSON.stringify(s, null, 1) }] })
const fail = m => ({ isError: true, content: [{ type: 'text', text: m }] })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const web = u => { // an address with a scheme must be http(s); a bare one gets https://
  try { const p = new URL(/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^[^/:]+:\d+/.test(u) ? u : 'https://' + u); return /^https?:$/.test(p.protocol) ? p.href : null } catch { return null }
}
const KEYS = { Enter: 'Return', Tab: 'Tab', Escape: 'Escape', Backspace: 'Backspace', Delete: 'Delete', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', PageDown: 'PageDown', PageUp: 'PageUp', Home: 'Home', End: 'End', Space: 'Space' }

function build(host, { confirm } = {}) { // confirm({ label, site }) -> Promise<boolean>: asked before a click that sends, pays, deletes or publishes (the in-app assistant)
  const s = new McpServer({ name: 'heliarc', version: host.version }, { instructions: 'Controls the Heliarc browser. Tabs have numeric ids; page tools act on the tab in front (use switch_tab first). The Private space is not reachable.' })
  const tab = id => host.tabs().find(t => t.id === id)
  const target = id => { // the tab to act on: the one asked for, else the one in front
    const t = id == null ? host.tabs().find(t => t.active) : tab(id)
    if (!t) throw new Error(id == null ? 'No tab is open in front' : `No tab ${id}. Use list_tabs.`)
    return t
  }
  const page = id => { // the page of a tab that is in front
    const t = target(id), wc = host.page(t.id)
    if (!wc) throw new Error(`Tab ${t.id} is not in front${t.asleep ? ' (it is asleep)' : ''}. Use switch_tab first.`)
    return wc
  }
  const loaded = async id => { await sleep(300); for (let i = 0; i < WAIT_LOAD / 250 && tab(id)?.loading; i++) await sleep(250) }
  const done = async id => { await loaded(id); const t = tab(id); return t ? text({ id: t.id, title: t.title, url: t.url, loading: t.loading, error: t.error }) : fail('The tab closed') }
  const tool = (name, description, shape, run) => s.registerTool(name, { description, inputSchema: shape }, async a => { try { return await run(a) } catch (e) { return fail(e.message) } })
  const tabArg = { tab: z.number().int().optional().describe('Tab id (default: the tab in front)') }

  tool('list_tabs', 'List the open tabs (not the Private ones) with id, title, address, space and whether it is in front.', {}, () => text(host.tabs()))
  tool('list_spaces', 'List the spaces (separate profiles with their own logins).', {}, () => text(host.spaces()))
  tool('open_tab', 'Open an address in a new tab and bring it to the front. Waits for the page to load.', { url: z.string(), space: z.string().optional().describe('Space name, e.g. Work (default: the one chosen by Heliarc)') }, async ({ url, space }) => {
    const u = web(url); if (!u) throw new Error('Only http and https addresses can be opened')
    if (space && !host.spaces().some(n => n.toLowerCase() === space.toLowerCase())) throw new Error(`Unknown space. Choose one of: ${host.spaces().join(', ')}`)
    return done(host.open(u, space))
  })
  tool('navigate', 'Load an address in a tab.', { url: z.string(), ...tabArg }, async ({ url, tab: id }) => {
    const u = web(url); if (!u) throw new Error('Only http and https addresses can be opened')
    const t = target(id); return done(host.navigate(t.id, u))
  })
  tool('switch_tab', 'Bring a tab to the front (wakes it if it was asleep).', { tab: z.number().int() }, ({ tab: id }) => { const t = target(id); host.activate(t.id); return done(t.id) })
  tool('close_tab', 'Close a tab.', { tab: z.number().int() }, ({ tab: id }) => { host.close(target(id).id); return text('Closed') })
  tool('history', 'Go back, go forward or reload in a tab.', { action: z.enum(['back', 'forward', 'reload']), ...tabArg }, ({ action, tab: id }) => { const t = target(id); page(t.id); host.history(t.id, action); return done(t.id) })
  tool('read_page', 'Read a page: title, address, visible text and the list of clickable or editable elements with a CSS selector for each. Use the selectors with click and type.', { ...tabArg, max_chars: z.number().int().min(500).max(100000).optional() }, async ({ tab: id, max_chars = 20000 }) => {
    const r = await page(id).executeJavaScript(ELEMENTS), cut = r.text.length > max_chars
    return text({ ...r, text: r.text.slice(0, max_chars), truncated: cut || undefined })
  })
  tool('screenshot', 'Take a picture of the page as the user sees it.', tabArg, async ({ tab: id }) => {
    const img = await page(id).capturePage(), { width } = img.getSize()
    return { content: [{ type: 'image', data: (width > 1280 ? img.resize({ width: 1280 }) : img).toPNG().toString('base64'), mimeType: 'image/png' }] }
  })
  const ask = async r => { if (confirm && r.sensitive && !(await confirm({ label: r.label, site: r.site }))) throw new Error('The user declined this click. Do not try again.') }
  const aim = async (wc, selector, txt) => {
    if (!selector && !txt) throw new Error('Give a selector or the text of the element')
    const r = await wc.executeJavaScript(locate(selector, txt)); if (r.error) throw new Error(r.error)
    await ask(r); return r
  }
  tool('click', 'Click an element, found by CSS selector (from read_page) or by its visible text.', { selector: z.string().optional(), text: z.string().optional(), ...tabArg }, async ({ selector, text: txt, tab: id }) => {
    const wc = page(id), t = target(id), { x, y } = await aim(wc, selector, txt)
    wc.sendInputEvent({ type: 'mouseMove', x, y }); wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
    return done(t.id)
  })
  tool('type', 'Type text into a field (replaces what it holds), optionally pressing Enter after.', { selector: z.string().optional(), text: z.string().optional().describe('Visible label or placeholder of the field'), value: z.string(), submit: z.boolean().optional(), ...tabArg }, async ({ selector, text: txt, value, submit, tab: id }) => {
    const wc = page(id), t = target(id), r = await aim(wc, selector, txt)
    if (!r.field) throw new Error('This element is not a text field')
    wc.focus(); await wc.executeJavaScript('document.activeElement?.select?.()'); value ? wc.insertText(value) : (wc.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' }), wc.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' }))
    if (submit) { await ask(await wc.executeJavaScript(focused)); wc.sendInputEvent({ type: 'keyDown', keyCode: 'Return' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Return' }) }
    return submit ? done(t.id) : text('Typed')
  })
  tool('select_option', 'Pick an option in a drop-down, found by CSS selector or by its label. The option is given by its text or value.', { selector: z.string().optional(), text: z.string().optional().describe('Label of the drop-down'), option: z.string(), ...tabArg }, async ({ selector, text: txt, option, tab: id }) => {
    if (!selector && !txt) throw new Error('Give a selector or the label of the drop-down')
    const r = await page(id).executeJavaScript(choose(selector, txt, option)); if (r.error) throw new Error(r.error)
    return text('Chose ' + r.chosen)
  })
  tool('wait_for', 'Wait until a text appears on the page or a visible element matches a selector (up to 30 seconds).', { text: z.string().optional(), selector: z.string().optional(), seconds: z.number().min(1).max(30).optional(), ...tabArg }, async ({ text: txt, selector, seconds = 10, tab: id }) => {
    if (!txt && !selector) throw new Error('Give a text or a selector to wait for')
    for (let i = 0; i < seconds * 4; i++) { if (await page(id).executeJavaScript(present(selector, txt))) return text('Found'); await sleep(250) }
    return fail(`Still not there after ${seconds} seconds`)
  })
  tool('organize_tab', 'Pin, unpin, favorite, unfavorite or put a tab to sleep; move it to another space (arg: space name) or into a folder of the sidebar (arg: folder name, created if missing).', { tab: z.number().int(), action: z.enum(['pin', 'unpin', 'favorite', 'unfavorite', 'sleep', 'move_to_space', 'move_to_folder']), arg: z.string().optional() }, ({ tab: id, action, arg }) => {
    const t = target(id), err = host.organize(t.id, action, arg); if (err) throw new Error(err)
    return text(tab(t.id) ?? 'Done')
  })
  tool('search_history', 'Search the browsing history (title or address), newest first. Read only; the Private space is never recorded.', { query: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }, ({ query, limit = 20 }) => text(host.searchHistory(query, limit)))
  tool('list_downloads', 'List the downloads (newest first) with their state and where the file is on this computer.', {}, () => text(host.downloads()))
  tool('press_key', 'Press a key in the page.', { key: z.enum(Object.keys(KEYS)), ...tabArg }, async ({ key, tab: id }) => {
    const wc = page(id); if (key === 'Enter') await ask(await wc.executeJavaScript(focused)); wc.focus(); wc.sendInputEvent({ type: 'keyDown', keyCode: KEYS[key] }); wc.sendInputEvent({ type: 'keyUp', keyCode: KEYS[key] }); return text('Pressed')
  })
  tool('scroll', 'Scroll the page.', { to: z.enum(['up', 'down', 'top', 'bottom']), ...tabArg }, async ({ to, tab: id }) => text(await page(id).executeJavaScript(
    `(() => { ${{ up: 'scrollBy(0, -innerHeight * .85)', down: 'scrollBy(0, innerHeight * .85)', top: 'scrollTo(0, 0)', bottom: 'scrollTo(0, document.documentElement.scrollHeight)' }[to]}; return { scrollY: Math.round(scrollY), scrollMax: document.documentElement.scrollHeight - innerHeight } })()`)))
  return s
}

// host: { version, organize(id, action, arg) -> error text | undefined, searchHistory(query, limit), downloads(), tabs(), spaces(), page(id) -> webContents of a tab in front | null, open(url, space) -> id, navigate, activate, close, history(id, action) }
function create(host) {
  let server = null, token = '', status = { running: false, port: PORT, error: null }
  const ok = req => { // DNS rebinding and web pages are kept out: only our own host name, no browser Origin, and the token
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '') || req.headers.origin) return 403
    const got = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, '')), want = Buffer.from(token)
    return got.length === want.length && crypto.timingSafeEqual(got, want) ? 200 : 401
  }
  const handle = async (req, res) => {
    const code = req.url === '/mcp' ? ok(req) : 404
    if (code !== 200) return res.writeHead(code).end()
    if (req.method !== 'POST') return res.writeHead(405, { Allow: 'POST' }).end()
    let body = '', size = 0
    for await (const c of req) { size += c.length; if (size > MAX_BODY) return res.writeHead(413).end(); body += c }
    let json; try { json = JSON.parse(body) } catch { return res.writeHead(400).end() }
    const mcp = build(host), transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }) // stateless: one server per request
    res.on('close', () => { transport.close(); mcp.close() })
    await mcp.connect(transport); await transport.handleRequest(req, res, json)
  }
  return {
    status: () => ({ ...status, token }),
    start: t => new Promise(resolve => {
      token = t; status = { running: false, port: PORT, error: null }
      server = http.createServer((req, res) => handle(req, res).catch(() => res.headersSent ? res.end() : res.writeHead(500).end()))
      server.once('error', e => { status.error = e.code === 'EADDRINUSE' ? `Port ${PORT} is already used by another program` : e.message; server = null; resolve() })
      server.listen(PORT, '127.0.0.1', () => { status.running = true; resolve() })
    }),
    stop: () => new Promise(resolve => { status = { running: false, port: PORT, error: null }; if (!server) return resolve(); const s = server; server = null; s.close(() => resolve()); s.closeAllConnections() }),
    newToken: () => crypto.randomBytes(24).toString('hex'),
  }
}
module.exports = { create, build, PORT }
