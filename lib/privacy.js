// Privacy hardening that doesn't depend on the window: third-party cookies, HTTPS upgrades, request headers.
const { getDomain } = require('tldts')

const site = u => { try { const { hostname } = new URL(u); return getDomain(hostname) || hostname } catch { return '' } }
const web = u => /^https?:/i.test(u)
// a request is third-party when the page it belongs to is on another site (extensions, files and workers have no such page)
const thirdParty = d => {
  if (d.resourceType === 'mainFrame' || !web(d.url)) return false
  const top = d.webContents?.getURL() || d.referrer || ''
  return web(top) && site(top) !== site(d.url)
}

const CLIENT_HINTS = { // sec-ch-ua: set by main.js from the brands the page itself reports (the made-up brand changes with each Chrome version)
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': `"${{ darwin: 'macOS', win32: 'Windows' }[process.platform] || 'Linux'}"`,
}

// Request filter of a session, in one place because Electron keeps a single listener per event:
// Global Privacy Control + Do Not Track, no cookies for third parties, then the ad blocker (unless the user allowed ads on that site)
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const NEEDS_ADS = ['tf1.fr'] // sites whose player refuses to start behind an ad blocker ("Un bloqueur de publicité empêche la lecture")
const adsAllowed = (list, h) => list.includes(h) || NEEDS_ADS.some(s => h === s || h.endsWith('.' + s))
// Sites the user blocked: "example.com" covers that domain and its subdomains, "example.com/shorts" only the addresses that start there
function blockEntry(input) { // what the user typed -> the entry to keep, or null if it isn't a site address
  try {
    const u = new URL('https://' + String(input).trim().replace(/^https?:\/\//i, '')), h = u.hostname.toLowerCase().replace(/^www\./, '')
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) && h !== 'localhost') return null
    const p = (u.pathname + u.search).replace(/\/$/, ''); return h + p
  } catch { return null }
}
function blockedBy(list, url) { // the entry that blocks this address, if any
  let u; try { u = new URL(url) } catch { return null }; if (!/^https?:$/.test(u.protocol)) return null
  const h = u.hostname.replace(/^www\./, ''), rest = u.pathname + u.search
  return (list || []).find(e => { const i = e.indexOf('/'), eh = i < 0 ? e : e.slice(0, i), ep = i < 0 ? '' : e.slice(i); return (h === eh || h.endsWith('.' + eh)) && (!ep || rest === ep || rest.startsWith(ep + '/') || rest.startsWith(ep + '?') || ep.includes('?') && rest.startsWith(ep)) }) || null
}
// A blocked site with a schedule ({ days: 0 = Sunday…6, from: 'HH:MM', to: 'HH:MM' }) is blocked only then; 22:00 to 07:00 runs past midnight, the night belonging to the day it started; from = to is the whole day
const mins = s => +s.slice(0, 2) * 60 + +s.slice(3)
function blockOn(s, now = new Date()) {
  if (!s) return true
  const t = now.getHours() * 60 + now.getMinutes(), a = mins(s.from), b = mins(s.to), night = a > b && t < b
  return s.days.includes((now.getDay() + (night ? 6 : 0)) % 7) && (a === b || (a < b ? t >= a && t < b : t >= a || t < b))
}
// the entries blocking right now: not paused (blockPauses: entry -> when its pause ends), and in their schedule
const activeBlocks = (st, now = new Date()) => (st.blockedSites || []).filter(e => !(st.blockPauses?.[e] > +now) && blockOn(st.blockSchedules?.[e], now))
function filterRequests(ses, settings, blocker = () => null) {
  const topHost = d => host(d.resourceType === 'mainFrame' ? d.url : d.webContents?.getURL() || d.referrer || d.url) // the site the request belongs to
  const off = d => adsAllowed(settings().adblockOff, topHost(d))
  const strip = d => settings().blockThirdPartyCookies && thirdParty(d) && !settings().cookiesOk.includes(topHost(d)) // cookiesOk: sites where the user allowed third-party cookies
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    d.requestHeaders['Sec-GPC'] = '1'; d.requestHeaders['DNT'] = '1'
    if (strip(d)) for (const k of Object.keys(d.requestHeaders)) if (k.toLowerCase() === 'cookie') delete d.requestHeaders[k]
    if (settings().fingerprint && d.url.startsWith('https:')) Object.assign(d.requestHeaders, CLIENT_HINTS) // Electron sends none, Chrome always does: sites like Google sign-in notice
    cb({ requestHeaders: d.requestHeaders })
  })
  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (d, cb) => {
    if (strip(d)) for (const k of Object.keys(d.responseHeaders || {})) if (k.toLowerCase() === 'set-cookie') delete d.responseHeaders[k]
    const b = blocker(), keep = r => cb(r?.responseHeaders ? r : { responseHeaders: d.responseHeaders })
    b && !off(d) ? b.onHeadersReceived(d, keep) : keep()
  })
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => { if (d.resourceType === 'mainFrame' && blockedBy(activeBlocks(settings()), d.url)) return cb({ cancel: true }); const b = blocker(); b && !off(d) ? b.onBeforeRequest(d, cb) : cb({}) })
}

// Local and private-network hosts are never upgraded: they rarely have a certificate
const LOCAL = /^(localhost|.*\.local|.*\.localhost|.*\.internal|.*\.lan|.*\.home\.arpa|[^.]+|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[.*\])$/i
function upgrade(u) {
  try { const x = new URL(u); if (x.protocol !== 'http:' || LOCAL.test(x.hostname)) return null; x.protocol = 'https:'; return x.toString() } catch { return null }
}
// Errors that mean "this server doesn't speak HTTPS" (refused, not TLS, timeout, empty reply). Certificate errors never fall back to HTTP.
const NO_HTTPS = [-102, -107, -118, -324]

module.exports = { CLIENT_HINTS, blockEntry, blockedBy, blockOn, activeBlocks, host, adsAllowed, filterRequests, upgrade, thirdParty, site, NO_HTTPS }
