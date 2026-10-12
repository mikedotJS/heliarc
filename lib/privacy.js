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

const major = process.versions.chrome.split('.')[0]
const CLIENT_HINTS = {
  'sec-ch-ua': `"Not?A_Brand";v="24", "Chromium";v="${major}", "Google Chrome";v="${major}"`, 'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': `"${{ darwin: 'macOS', win32: 'Windows' }[process.platform] || 'Linux'}"`,
}

// Request filter of a session, in one place because Electron keeps a single listener per event:
// Global Privacy Control + Do Not Track, no cookies for third parties, then the ad blocker (unless the user allowed ads on that site)
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
function filterRequests(ses, settings, blocker = () => null) {
  const off = d => settings().adblockOff.includes(host(d.resourceType === 'mainFrame' ? d.url : d.webContents?.getURL() || d.referrer || d.url))
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    d.requestHeaders['Sec-GPC'] = '1'; d.requestHeaders['DNT'] = '1'
    if (settings().blockThirdPartyCookies && thirdParty(d)) for (const k of Object.keys(d.requestHeaders)) if (k.toLowerCase() === 'cookie') delete d.requestHeaders[k]
    if (settings().fingerprint && d.url.startsWith('https:')) Object.assign(d.requestHeaders, CLIENT_HINTS) // Electron sends none, Chrome always does: sites like Google sign-in notice
    cb({ requestHeaders: d.requestHeaders })
  })
  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (d, cb) => {
    if (settings().blockThirdPartyCookies && thirdParty(d)) for (const k of Object.keys(d.responseHeaders || {})) if (k.toLowerCase() === 'set-cookie') delete d.responseHeaders[k]
    const b = blocker(), keep = r => cb(r?.responseHeaders ? r : { responseHeaders: d.responseHeaders })
    b && !off(d) ? b.onHeadersReceived(d, keep) : keep()
  })
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => { const b = blocker(); b && !off(d) ? b.onBeforeRequest(d, cb) : cb({}) })
}

// Local and private-network hosts are never upgraded: they rarely have a certificate
const LOCAL = /^(localhost|.*\.local|.*\.localhost|.*\.internal|[^.]+|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[.*\])$/i
function upgrade(u) {
  try { const x = new URL(u); if (x.protocol !== 'http:' || LOCAL.test(x.hostname)) return null; x.protocol = 'https:'; return x.toString() } catch { return null }
}
// Errors that mean "this server doesn't speak HTTPS" (refused, not TLS, timeout, empty reply). Certificate errors never fall back to HTTP.
const NO_HTTPS = [-102, -107, -118, -324]

module.exports = { host, filterRequests, upgrade, thirdParty, site, NO_HTTPS }
