// DevTools for an AI assistant (lib/mcp.js): console, network, styles, storage, emulation, performance and full-page pictures of a tab,
// through Chromium's own DevTools protocol (webContents.debugger). A tab is attached the first time it is inspected and stays so until it closes:
// tabs nobody inspects are left alone (some anti-bot checks notice a page being watched). Works alongside the DevTools window the user can open.
const fs = require('fs')
const MAX = 500, BODY = 100000, MAX_SHOT = 16000
const watched = new WeakMap() // webContents -> { log, requests, sheets, emulated }
const VITALS = fs.readFileSync(require('path').join(require('path').dirname(require.resolve('web-vitals')), 'web-vitals.iife.js'), 'utf8') // Google's own measure of the Web Vitals, run inside the page

const keep = (list, x) => { list.push(x); if (list.length > MAX) list.shift() }
const where = f => f?.url ? `${f.url}:${(f.lineNumber ?? 0) + 1}` : undefined
const arg = a => a.type === 'string' ? a.value : a.unserializableValue ?? (a.value !== undefined ? JSON.stringify(a.value) : a.description ?? a.type)
const level = l => l === 'warning' ? 'warn' : l === 'verbose' ? 'debug' : l

async function attach(wc) {
  if (watched.has(wc)) return watched.get(wc)
  const d = wc.debugger, r = { log: [], requests: new Map(), sheets: new Map(), emulated: {} }
  if (!d.isAttached()) d.attach('1.3')
  watched.set(wc, r)
  d.on('detach', () => watched.delete(wc))
  d.on('message', (_, m, p) => {
    if (m === 'Runtime.consoleAPICalled') keep(r.log, { level: level(p.type), text: p.args.map(arg).join(' '), at: where(p.stackTrace?.callFrames[0]), time: Date.now() })
    else if (m === 'Runtime.exceptionThrown') { const e = p.exceptionDetails; keep(r.log, { level: 'error', text: e.exception?.description || e.text, at: where(e), time: Date.now(), uncaught: true }) }
    else if (m === 'Log.entryAdded') keep(r.log, { level: level(p.entry.level), text: p.entry.text, at: p.entry.url, source: p.entry.source, time: Date.now() })
    else if (m === 'CSS.styleSheetAdded') r.sheets.set(p.header.styleSheetId, p.header.sourceURL || (p.header.isInline ? 'inline <style>' : ''))
    else if (m.startsWith('Network.')) network(r.requests, m, p)
  })
  await Promise.all(['Runtime.enable', 'Log.enable', 'Network.enable', 'Performance.enable'].map(c => d.sendCommand(c)))
  return r
}
function network(reqs, m, p) {
  let q = reqs.get(p.requestId)
  if (m === 'Network.requestWillBeSent') {
    if (q && p.redirectResponse) { reqs.delete(p.requestId); reqs.set(p.requestId + '.redirect' + Date.now(), { ...q, status: p.redirectResponse.status, done: true, ms: Math.round((p.timestamp - q.t0) * 1000) }) } // a redirect: the hop is kept as its own row
    reqs.set(p.requestId, { id: p.requestId, method: p.request.method, url: p.request.url, type: p.type, t0: p.timestamp, sent: p.request.headers, post: p.request.hasPostData, postData: p.request.postData, at: new Date(p.wallTime * 1000).toISOString() })
    if (reqs.size > MAX) reqs.delete(reqs.keys().next().value)
  } else if (!q) return
  else if (m === 'Network.responseReceived') Object.assign(q, { status: p.response.status, statusText: p.response.statusText, mime: p.response.mimeType, got: p.response.headers, cache: p.response.fromDiskCache || p.response.fromServiceWorker || undefined, ip: p.response.remoteIPAddress })
  else if (m === 'Network.loadingFinished') Object.assign(q, { done: true, size: p.encodedDataLength, ms: Math.round((p.timestamp - q.t0) * 1000) })
  else if (m === 'Network.loadingFailed') Object.assign(q, { done: true, failed: p.blockedReason ? `blocked (${p.blockedReason})` : p.canceled ? 'canceled' : p.errorText, ms: Math.round((p.timestamp - q.t0) * 1000) })
}
// every DevTools call gives up after a while: a hidden or minimized window can stop drawing, and a picture would wait for it forever
const send = (wc, c, p, ms = 20000) => Promise.race([wc.debugger.sendCommand(c, p), new Promise((_, no) => setTimeout(() => no(new Error('DevTools did not answer in time: the Heliarc window may be hidden or minimized. Bring it to the front and try again.')), ms))])

function consoleMessages(wc, { level: lv, contains, limit = 100 }) {
  const all = watched.get(wc)?.log || [], hit = all.filter(x => (!lv || x.level === lv || (lv === 'warn' && x.level === 'error')) && (!contains || x.text.toLowerCase().includes(contains.toLowerCase())))
  return { total: all.length, shown: Math.min(limit, hit.length), messages: hit.slice(-limit).map(x => ({ ...x, time: new Date(x.time).toISOString() })) }
}
function requests(wc, { contains, type, failed, limit = 100 }) {
  const all = [...(watched.get(wc)?.requests.values() || [])]
  const hit = all.filter(q => (!contains || q.url.toLowerCase().includes(contains.toLowerCase())) && (!type || q.type?.toLowerCase() === type.toLowerCase()) && (!failed || q.failed || q.status >= 400))
  return { total: all.length, shown: Math.min(limit, hit.length), requests: hit.slice(-limit).map(q => ({ id: q.id, method: q.method, url: q.url.length > 300 ? q.url.slice(0, 300) + '…' : q.url, type: q.type, status: q.failed ? 'failed: ' + q.failed : q.status ?? 'pending', mime: q.mime, bytes: q.size, ms: q.ms, cache: q.cache })) }
}
async function request(wc, id) {
  const q = watched.get(wc)?.requests.get(id); if (!q) throw new Error(`No request ${id}. Use list_network_requests.`)
  let body, postData = q.postData
  if (q.post && !postData) postData = (await send(wc, 'Network.getRequestPostData', { requestId: id }).catch(() => ({}))).postData
  if (q.done && !q.failed) {
    const b = await send(wc, 'Network.getResponseBody', { requestId: id }).catch(() => null)
    body = !b ? 'Not available any more (the page let it go, or it was a redirect)' : b.base64Encoded ? `Binary (${q.mime}), ${Buffer.from(b.body, 'base64').length} bytes` : b.body.length > BODY ? b.body.slice(0, BODY) + `\n… cut: ${b.body.length} characters in all` : b.body
  }
  return { id, method: q.method, url: q.url, type: q.type, status: q.failed ? 'failed: ' + q.failed : q.status, statusText: q.statusText, ip: q.ip, at: q.at, ms: q.ms, bytes: q.size, requestHeaders: q.sent, postData: postData?.slice(0, BODY), responseHeaders: q.got, body }
}

async function evaluate(wc, code) { // like the DevTools console: statements, top-level await, and a function is called
  await attach(wc)
  const fn = /^\s*(async\s+)?(function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)/.test(code)
  const r = await send(wc, 'Runtime.evaluate', { expression: fn ? `await (${code})()` : code, replMode: true, awaitPromise: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  let v = r.result
  if (v.objectId && v.subtype !== 'node') v = (await send(wc, 'Runtime.callFunctionOn', { objectId: v.objectId, functionDeclaration: 'function () { return this }', returnByValue: true })).result // an object comes back by value (replMode keeps awaited ones by reference)
  if (r.result.objectId) send(wc, 'Runtime.releaseObject', { objectId: r.result.objectId }).catch(() => {})
  return v.type === 'undefined' ? 'undefined' : v.subtype === 'node' ? v.description : v.value !== undefined ? v.value : v.unserializableValue ?? v.description
}

async function matchedRules(wc, selector) { // the Styles panel: which rules set what on the element, most specific first
  const r = await attach(wc)
  if (!r.css) { await send(wc, 'DOM.enable'); await send(wc, 'CSS.enable'); r.css = true }
  const { root } = await send(wc, 'DOM.getDocument', { depth: 0 }), { nodeId } = await send(wc, 'DOM.querySelector', { nodeId: root.nodeId, selector })
  if (!nodeId) return []
  const m = await send(wc, 'CSS.getMatchedStylesForNode', { nodeId }), props = st => (st?.cssProperties || []).filter(p => p.value && !p.disabled && !p.implicit && p.range).map(p => `${p.name}: ${p.value}${p.important ? ' !important' : ''}`)
  const rules = (m.matchedCSSRules || []).filter(x => x.rule.origin !== 'user-agent').reverse().map(x => ({ selector: x.rule.selectorList.text, from: `${r.sheets.get(x.rule.styleSheetId) || 'stylesheet'}${x.rule.style.range ? ':' + (x.rule.style.range.startLine + 1) : ''}`, media: x.rule.media?.map(q => q.text).join(', ') || undefined, set: props(x.rule.style) })).filter(x => x.set.length)
  const inline = props(m.inlineStyle)
  return [...(inline.length ? [{ selector: 'style attribute', set: inline }] : []), ...rules].slice(0, 25)
}

async function fullPage(wc) { // the whole page, beyond what is on screen
  await attach(wc)
  const { cssContentSize: s } = await send(wc, 'Page.getLayoutMetrics')
  wc.invalidate() // asks for a fresh frame, which the picture waits for
  const h = Math.min(Math.ceil(s.height), MAX_SHOT), r = await send(wc, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.ceil(s.width), height: h, scale: 1 } })
  return { data: r.data, cut: s.height > MAX_SHOT }
}

// Emulation, as DevTools' device mode: stays on the tab until reset
const UA = { iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', ipad: 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v} Mobile Safari/537.36' }
const DEVICES = { iphone: [390, 844, 3, UA.iphone], ipad: [820, 1180, 2, UA.ipad], android: [412, 915, 2.625, UA.android] }
const NETWORK = { // as DevTools' throttling presets, in bytes per second
  offline: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, slow: { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 50000 },
  fast: { offline: false, latency: 563, downloadThroughput: 180000, uploadThroughput: 84375 }, none: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
}
async function emulate(wc, o) {
  const r = await attach(wc), e = r.emulated
  if (o.reset) {
    await send(wc, 'Emulation.clearDeviceMetricsOverride'); await send(wc, 'Emulation.setTouchEmulationEnabled', { enabled: false }); await send(wc, 'Emulation.setEmulatedMedia', { features: [] })
    await send(wc, 'Network.emulateNetworkConditions', NETWORK.none); await send(wc, 'Emulation.setCPUThrottlingRate', { rate: 1 }); await send(wc, 'Network.setUserAgentOverride', { userAgent: wc.getUserAgent() })
    r.emulated = {}; return {}
  }
  if (o.device || o.width) {
    const [w, h, dpr, ua] = o.device && o.device !== 'desktop' ? DEVICES[o.device] : [o.width, o.height, 1, null], mobile = !!ua
    if (o.device === 'desktop') await send(wc, 'Emulation.clearDeviceMetricsOverride')
    else await send(wc, 'Emulation.setDeviceMetricsOverride', { width: w, height: h || 800, deviceScaleFactor: dpr, mobile })
    await send(wc, 'Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 })
    await send(wc, 'Network.setUserAgentOverride', { userAgent: ua ? ua.replace('{v}', process.versions.chrome) : wc.getUserAgent() })
    e.screen = o.device === 'desktop' ? undefined : `${o.device || 'custom'} ${w}×${h || 800}`
  }
  if (o.color_scheme) { await send(wc, 'Emulation.setEmulatedMedia', { features: o.color_scheme === 'auto' ? [] : [{ name: 'prefers-color-scheme', value: o.color_scheme }] }); e.colorScheme = o.color_scheme === 'auto' ? undefined : o.color_scheme }
  if (o.network) { await send(wc, 'Network.emulateNetworkConditions', NETWORK[o.network]); e.network = o.network === 'none' ? undefined : o.network }
  if (o.cpu_slowdown) { await send(wc, 'Emulation.setCPUThrottlingRate', { rate: o.cpu_slowdown }); e.cpuSlowdown = o.cpu_slowdown > 1 ? o.cpu_slowdown : undefined }
  return JSON.parse(JSON.stringify(e))
}

async function performance(wc) {
  await attach(wc)
  const { metrics } = await send(wc, 'Performance.getMetrics'), m = Object.fromEntries(metrics.map(x => [x.name, x.value]))
  const page = await wc.executeJavaScript(`(() => new Promise(done => { ${VITALS}
    const vitals = {}, r = x => Math.round(x)
    for (const f of ['onTTFB', 'onFCP', 'onLCP', 'onCLS', 'onINP']) webVitals[f](v => { vitals[v.name] = { value: v.name === 'CLS' ? +v.value.toFixed(3) : r(v.value), rating: v.rating } }, { reportAllChanges: true })
    const n = performance.getEntriesByType('navigation')[0], res = performance.getEntriesByType('resource')
    setTimeout(() => done({ vitals, navigation: n && { ttfbMs: r(n.responseStart), domContentLoadedMs: r(n.domContentLoadedEventEnd), loadMs: r(n.loadEventEnd), transferBytes: n.transferSize, protocol: n.nextHopProtocol },
      resources: { count: res.length, transferBytes: res.reduce((s, x) => s + x.transferSize, 0), slowest: res.sort((a, b) => b.duration - a.duration).slice(0, 5).map(x => ({ url: x.name.slice(0, 200), ms: r(x.duration), type: x.initiatorType })) } }), 1200)
  }))()`)
  if (!page.vitals.CLS) page.vitals.CLS = { value: 0, rating: 'good', note: 'no layout shift seen' }
  if (!page.vitals.INP) page.vitals.INP = { note: 'appears once the user (or click) interacts with the page' }
  return { ...page, browser: { jsHeapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), domNodes: m.Nodes, layouts: m.LayoutCount, styleRecalcs: m.RecalcStyleCount, scriptMs: r1(m.ScriptDuration), layoutMs: r1(m.LayoutDuration), taskMs: r1(m.TaskDuration) } }
}
const r1 = s => Math.round((s || 0) * 1000)

module.exports = { attach, watching: wc => watched.has(wc), consoleMessages, requests, request, evaluate, matchedRules, fullPage, emulate, emulated: wc => watched.get(wc)?.emulated || {}, performance, DEVICES: Object.keys(DEVICES), NETWORK: Object.keys(NETWORK) }
