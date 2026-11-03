const http = require('http'), crypto = require('crypto')
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { z } = require('zod')
// Lets an AI assistant (Claude Code, Claude Desktop, Cursor…) drive Heliarc over MCP. Off by default; local only (127.0.0.1) and every request needs the secret token
// shown in Settings. The Private space is invisible here. `host` is what main.js lets the assistant do: tabs, spaces, and the page of a tab in front.
const PORT = 47821, MAX_BODY = 1 << 20, WAIT_LOAD = 15000, MAX_ELEMENTS = 150

// what sends, pays, deletes or publishes: the in-app assistant asks the user before clicking it
const RISKY = /\b(pay|order|buy|purchase|checkout|delete|remove|erase|send|publish|post|submit|confirm|subscribe|donate|transfer|sign out|log out|payer|commander|acheter|valider|supprimer|envoyer|publier|confirmer|virement)\b/i // as written: it is also pasted into the page scripts
const CLICKABLE = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=option],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=checkbox],[role=radio],[role=switch],[role=combobox],[role=textbox],[role=treeitem],[contenteditable=true],[onclick],[tabindex]:not([tabindex="-1"])'
const OPTIONS = '[role=option],[role=menuitem],[role=menuitemradio],[role=treeitem],[role=listbox] *,[data-value],li' // what a custom drop-down or a list of suggestions is made of
// what every page script shares. A custom check box hides the real input: its visible label stands in for it. A selector prefers ids and labels that are meant to last
const PAGE = `
  const shown = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const visible = e => shown(e) ? e : (e.matches('input[type=checkbox],input[type=radio]') && [...(e.labels || [])].find(shown)) || null
  const label = e => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(i => document.getElementById(i)?.innerText || '').join(' ').trim() || [...(e.labels || [])].map(l => l.innerText).join(' ') || e.innerText || e.placeholder || e.value || e.title || '').trim().replace(/\\s+/g, ' ')
  const one = q => { try { return document.querySelectorAll(q).length === 1 } catch { return false } }
  const stable = e => e.id && !/\\d{4,}|^[:_]|^[a-f0-9-]{16,}$/i.test(e.id) && one('#' + CSS.escape(e.id))
  const sel = e => {
    if (stable(e)) return '#' + CSS.escape(e.id)
    for (const a of ['data-testid', 'data-test', 'data-qa', 'name', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && v.length < 60) { const c = e.tagName.toLowerCase() + '[' + a + '=' + JSON.stringify(v) + ']'; if (one(c)) return c } }
    const p = []; for (; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) { if (stable(e)) { p.unshift('#' + CSS.escape(e.id)); break } let n = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) n++; p.unshift(e.tagName.toLowerCase() + ':nth-of-type(' + n + ')') } return p.join(' > ')
  }
  const can = e => e.scrollHeight > e.clientHeight + 8 && /auto|scroll/.test(getComputedStyle(e).overflowY)
  const inner = root => [...root.querySelectorAll('*')].filter(e => can(e) && shown(e)).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0]
  const scroller = (selector) => { // what scrolls: the one asked for, else the open dialog, else the page, else the biggest scrolling area (many apps scroll inside the page)
    if (selector) return document.querySelector(selector)
    const dlg = [...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]')].filter(shown).pop(), win = document.scrollingElement
    return dlg ? ((can(dlg) ? dlg : inner(dlg)) || win) : win.scrollHeight > innerHeight + 8 ? win : (inner(document.body) || win)
  }
  const where = s => ({ scrollY: Math.round(s.scrollTop), scrollMax: s.scrollHeight - s.clientHeight, scrolling: s === document.scrollingElement ? 'page' : sel(s) })
`
const ELEMENTS = `(() => { ${PAGE}
  const els = [...document.querySelectorAll(${JSON.stringify(CLICKABLE)})].map(e => [e, visible(e)]).filter(x => x[1]).slice(0, 1000)
  return { title: document.title, url: location.href, text: document.body.innerText, focus: document.activeElement && document.activeElement !== document.body ? label(document.activeElement).slice(0, 60) : undefined, ...where(scroller()),
    elements: els.map(([e, v]) => { const r = v.getBoundingClientRect(), ck = /^(checkbox|radio)$/.test(e.type) ? e.checked : e.getAttribute('aria-checked'); return { selector: sel(e), tag: e.tagName.toLowerCase(), role: e.getAttribute('role') || undefined, type: e.type || undefined, label: label(e).slice(0, 60), value: /^(text|search|email|url|tel|number|textarea|select-one)$/.test(e.type) && e.value ? e.value.slice(0, 60) : undefined, href: e.href || undefined, checked: ck === 'true' ? true : ck === 'false' ? false : ck ?? undefined, expanded: e.getAttribute('aria-expanded') || undefined, disabled: e.disabled || undefined, inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth } }) }
})()`
// where to click: the centre of the element, found by CSS selector or by its visible text (the exact match first; the kinds listed in `prefer` before the others)
const locate = (selector, text, prefer) => `(() => { ${PAGE}
  const selector = ${JSON.stringify(selector ?? null)}, text = ${JSON.stringify(text?.toLowerCase() ?? null)}, prefer = ${JSON.stringify(prefer ?? null)}
  let el
  try { el = selector ? document.querySelector(selector) : null } catch { return { error: 'Invalid selector' } }
  if (!el && text) {
    const seen = q => [...document.querySelectorAll(q)].map(visible).filter(Boolean), find = list => list.find(e => label(e).toLowerCase() === text) || list.find(e => label(e).toLowerCase().includes(text))
    el = (prefer && find(seen(prefer))) || find(seen(${JSON.stringify(CLICKABLE + ',label,summary')}))
    if (!el) { const m = seen('body *').slice(0, 5000).filter(e => label(e).toLowerCase() === text); el = m.find(e => !m.some(o => o !== e && e.contains(o))) } // any text on the page, the innermost element that holds it
  }
  if (!el) return { error: 'No element found' }
  el = visible(el); if (!el) return { error: 'This element is not visible. Scroll, or open what holds it.' }
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
  const done = async (id, extra) => { await loaded(id); const t = tab(id); return t ? text({ id: t.id, title: t.title, url: t.url, loading: t.loading, error: t.error, ...extra }) : fail('The tab closed') }
  const plain = m => /UnknownVizError|Script failed to execute|Object has been destroyed|Render frame was disposed|ERR_[A-Z_]+/.test(m) ? 'The page is changing or still loading. Wait a moment, then try again.' : m
  const tool = (name, description, shape, run) => s.registerTool(name, { description, inputSchema: shape }, async a => { try { return await run(a) } catch (e) { return fail(plain(e.message)) } })
  const settle = async wc => { // a page that builds itself late (single-page apps): wait until it is loaded and its text stops changing
    for (let i = 0, last = -1; i < 30; i++) {
      const p = await wc.executeJavaScript('({ r: document.readyState, n: document.body ? document.body.innerText.length : 0 })').catch(() => ({ n: 0 }))
      if (p.r === 'complete' && p.n === last && (p.n > 0 || i > 6)) return
      last = p.n; await sleep(300)
    }
  }
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
  tool('read_page', 'Read a page: title, address, the clickable or editable elements (each with a CSS selector, a label, its state and whether it is on screen), then the text. Waits for a page that builds itself late. A long page comes in parts: next_offset continues the text, next_elements the list.', { ...tabArg, max_chars: z.number().int().min(500).max(100000).optional().describe('Size of one part of the text (default 8000)'), offset: z.number().int().min(0).optional().describe('Where the text starts (next_offset of the previous answer)'), elements_from: z.number().int().min(0).optional().describe('Where the list of elements starts (next_elements of the previous answer)') }, async ({ tab: id, max_chars = 8000, offset = 0, elements_from = 0 }) => {
    const wc = page(id); await settle(wc)
    const { text: all, elements, ...r } = await wc.executeJavaScript(ELEMENTS), end = Math.min(offset + max_chars, all.length), last = elements_from + MAX_ELEMENTS
    return text(JSON.stringify({ ...r, elementsTotal: elements.length, next_elements: last < elements.length ? last : undefined, elements: elements.slice(elements_from, last), textTotal: all.length, next_offset: end < all.length ? end : undefined, text: all.slice(offset, end) }))
  })
  tool('screenshot', 'Take a picture of the page as the user sees it, with a short written description of what is on screen.', tabArg, async ({ tab: id }) => {
    const wc = page(id), img = await wc.capturePage(), { width } = img.getSize(), r = await wc.executeJavaScript(ELEMENTS)
    const seen = r.elements.filter(e => e.inView).slice(0, 40).map(e => `[${e.role || (e.tag === 'input' ? e.type : e.tag)}] ${e.label}${e.value ? ` = ${e.value}` : ''}${e.checked === undefined ? '' : e.checked ? ' (checked)' : ' (unchecked)'}`)
    return { content: [{ type: 'image', data: (width > 1280 ? img.resize({ width: 1280 }) : img).toPNG().toString('base64'), mimeType: 'image/png' }, { type: 'text', text: `${r.title} (${r.url})\nScrolled ${r.scrollY} of ${r.scrollMax}${r.focus ? `\nFocus: ${r.focus}` : ''}\nOn screen: ${seen.join(' | ') || 'no clickable element'}` }] }
  })
  const ask = async r => { if (confirm && r.sensitive && !(await confirm({ label: r.label, site: r.site }))) throw new Error('The user declined this click. Do not try again.') }
  const aim = async (wc, selector, txt, prefer) => {
    if (!selector && !txt) throw new Error('Give a selector or the text of the element')
    const r = await wc.executeJavaScript(locate(selector, txt, prefer)); if (r.error) throw new Error(r.error)
    await ask(r); return r
  }
  const press = (wc, { x, y }) => { wc.sendInputEvent({ type: 'mouseMove', x, y }); wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }) }
  tool('click', 'Click an element, found by CSS selector (from read_page) or by its visible text: a button, a link, a check box, a suggestion of a list, any text on the page.', { selector: z.string().optional(), text: z.string().optional(), ...tabArg }, async ({ selector, text: txt, tab: id }) => {
    const wc = page(id), t = target(id), r = await aim(wc, selector, txt)
    press(wc, r); return done(t.id, { clicked: r.label })
  })
  tool('type', 'Type text into a field (replaces what it holds), optionally pressing Enter after. `value` is what to write; `text` only helps to find the field.', { selector: z.string().optional(), text: z.string().optional().describe('Visible label or placeholder used to FIND the field (not what to write: that is value)'), value: z.string().optional().describe('What to write in the field (empty text clears it)'), submit: z.boolean().optional(), ...tabArg }, async ({ selector, text: txt, value, submit, tab: id }) => {
    if (value === undefined) throw new Error('Missing value: the text to write in the field. (text only finds the field.)')
    const wc = page(id), t = target(id), r = await aim(wc, selector, txt)
    if (!r.field) throw new Error('This element is not a text field')
    wc.focus(); await wc.executeJavaScript('document.activeElement?.select?.()'); value ? wc.insertText(value) : (wc.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' }), wc.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' }))
    if (submit) { await ask(await wc.executeJavaScript(focused)); wc.sendInputEvent({ type: 'keyDown', keyCode: 'Return' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Return' }) }
    return submit ? done(t.id) : text('Typed')
  })
  tool('select_option', 'Pick an option in a drop-down, found by CSS selector or by its label; the option is given by its text or value. Works on custom drop-downs too (opens them, clicks the option). With only `option`, picks it in the list that is already open, such as the suggestions after typing in a search field.', { selector: z.string().optional(), text: z.string().optional().describe('Label of the drop-down'), option: z.string(), ...tabArg }, async ({ selector, text: txt, option, tab: id }) => {
    const wc = page(id)
    if (selector || txt) {
      const r = await wc.executeJavaScript(choose(selector, txt, option))
      if (!r.error) return text('Chose ' + r.chosen)
      if (r.error !== 'No drop-down found') throw new Error(r.error)
      press(wc, await aim(wc, selector, txt)); await sleep(400) // not a native one: open it
    }
    const o = await aim(wc, null, option, OPTIONS); press(wc, o); await sleep(200)
    return text('Chose ' + o.label)
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
  tool('scroll', 'Scroll the page, or the area that scrolls inside it (an open dialog, a long form, a list), then say where it is. Give a selector to scroll one given area.', { to: z.enum(['up', 'down', 'top', 'bottom']), selector: z.string().optional().describe('The area to scroll (default: the open dialog, else the page, else the biggest scrolling area)'), ...tabArg }, async ({ to, selector, tab: id }) => {
    const wc = page(id), r = await wc.executeJavaScript(`(() => { ${PAGE}
      const s = scroller(${JSON.stringify(selector ?? null)}); if (!s) return { error: 'No element found' }
      ${{ up: 's.scrollBy(0, -s.clientHeight * .85)', down: 's.scrollBy(0, s.clientHeight * .85)', top: 's.scrollTo(0, 0)', bottom: 's.scrollTo(0, s.scrollHeight)' }[to]}; return where(s) })()`)
    if (r.error) throw new Error(r.error)
    await sleep(300); return text(r) // lists that draw only what is on screen need a moment
  })
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
