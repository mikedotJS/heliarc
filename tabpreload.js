// Runs inside every web page (isolated world): detects logins to offer saving them, and fills saved logins / profile on focus.
const { ipcRenderer, contextBridge } = require('electron')
if (location.protocol === 'file:' && location.pathname.endsWith('/ui/system.html')) contextBridge.exposeInMainWorld('sys', { trust: () => ipcRenderer.invoke('sys:trust') }) // the invalid-certificate screen's "Continue anyway"
const PROFILE = { email: 'email', tel: 'phone', 'given-name': 'first', 'family-name': 'last', name: 'name', organization: 'org', 'street-address': 'street', 'address-line1': 'street', 'postal-code': 'zip', 'address-level2': 'city', 'country-name': 'country' }
const LOGIN = /log ?in|sign ?in|sign ?up|continue|submit|next|connexion|connecter|identifier|valider/i
const visible = el => { const r = el.getBoundingClientRect(); return r.width > 10 && r.height > 10 && getComputedStyle(el).visibility !== 'hidden' }
const setValue = (el, v) => { // frameworks listen to input events, not to .value
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
}
const scope = el => el.form || el.closest('form') || document
const passField = root => [...root.querySelectorAll('input[type=password]')].find(visible)
const userField = (root, pass) => {
  const all = [...root.querySelectorAll('input:is([type=text],[type=email],[type=tel],:not([type]))')].filter(visible)
  const before = all.filter(i => !pass || i.compareDocumentPosition(pass) & Node.DOCUMENT_POSITION_FOLLOWING)
  return before.at(-1) || null
}

function capture(root) {
  const pass = passField(root); if (!pass?.value) return
  ipcRenderer.send('pw:captured', { user: userField(root, pass)?.value || '', pass: pass.value })
}
addEventListener('submit', e => capture(e.target), true)
addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.type === 'password') capture(scope(e.target)) }, true)
addEventListener('click', e => { // SPA logins submit without a form submit event; ignore "show password" style buttons
  const b = e.target.closest?.('button, input[type=submit], [role=button]')
  if (b && (/^submit$/i.test(b.getAttribute('type')) || LOGIN.test(b.innerText || b.value || b.getAttribute('aria-label') || ''))) capture(scope(b))
}, true)

// Chrome Web Store: its own "Add to Chrome" button stays disabled outside Chrome, so turn it into a working "Add to Heliarc".
if (location.hostname === 'chromewebstore.google.com') {
  const say = (b, t) => { const el = [...b.querySelectorAll('*')].find(el => !el.children.length && el.textContent.trim()) || b; if (el.textContent !== t) el.textContent = t } // keep the button's own inner markup so it keeps Google's colors
  const extId = () => location.pathname.split('/').find(s => /^[a-p]{32}$/.test(s))
  let installed = false
  const swap = () => (document.querySelector('[jsname=gQ2Xie]')?.click(), document.querySelectorAll('button[disabled][class*="UywwFc-LgbsSe"], button[data-heliarc]').forEach(b => {
    if (b.dataset.busy) return
    b.disabled = installed; say(b, installed ? '✓ Added to Heliarc' : 'Add to Heliarc'); if (b.dataset.heliarc) return
    b.dataset.heliarc = '1'
    b.addEventListener('click', async e => {
      e.stopImmediatePropagation(); e.preventDefault(); if (!e.isTrusted || b.dataset.busy) return
      b.dataset.busy = '1'; say(b, 'Adding…')
      const r = await ipcRenderer.invoke('ext:install', location.href).catch(err => ({ error: err.message }))
      delete b.dataset.busy; installed = !r.error; r.error ? say(b, 'Retry — ' + r.error.slice(0, 60)) : swap()
    }, true)
  }))
  const check = () => ipcRenderer.invoke('ext:has', extId()).then(has => { installed = has; swap() }, () => {})
  addEventListener('DOMContentLoaded', () => { check(); new MutationObserver(swap).observe(document.body, { childList: true, subtree: true }) })
  addEventListener('focus', check) // the extension may have been removed from Heliarc in the meantime
}

// Fill only when the user themselves just clicked the field (or tabbed into it): a script calling .focus() must not trigger a fill.
let intent = { el: null, at: 0 }, creds, profile
async function fill(el) {
  if (!(el instanceof HTMLInputElement) || el.value || !visible(el)) return
  const token = (el.autocomplete || '').split(' ').pop()
  if (el.type === 'password' || el === userField(scope(el), passField(scope(el)))) {
    const root = scope(el), pass = passField(root); if (!pass) return
    creds ??= await ipcRenderer.invoke('pw:get'); if (!creds?.length) return
    const user = userField(root, pass), c = creds.find(x => x.user === user?.value) || creds[0]
    if (user && !user.value) setValue(user, c.user)
    if (!pass.value) setValue(pass, c.pass)
  } else if (PROFILE[token]) {
    profile ??= await ipcRenderer.invoke('profile:get'); if (!profile) return
    for (const f of scope(el).querySelectorAll('input[autocomplete]')) {
      const key = PROFILE[(f.autocomplete || '').split(' ').pop()]
      if (key && !f.value && profile[key] && visible(f)) setValue(f, profile[key])
    }
  }
}
addEventListener('pointerdown', e => { if (e.isTrusted) { intent = { el: e.target, at: Date.now() }; fill(e.target) } }, true)
addEventListener('keydown', e => { if (e.isTrusted && e.key === 'Tab') intent = { el: 'tab', at: Date.now() } }, true)
addEventListener('focusin', e => { if (Date.now() - intent.at < 1000 && intent.el === 'tab') fill(e.target) }, true)
// a two-finger horizontal swipe goes back / forward, unless the page itself can still scroll that way (the lock swallows the trackpad's momentum)
if (window === top) {
  let swipe = 0, swipeAt = 0, swipeLock = 0
  const scrolls = (el, dx) => {
    for (; el && el !== document.documentElement; el = el.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth && (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1)) return true
    }
    const d = document.scrollingElement
    return d && (dx < 0 ? d.scrollLeft > 0 : d.scrollLeft + d.clientWidth < d.scrollWidth - 1)
  }
  addEventListener('wheel', e => {
    const now = Date.now(); if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || now < swipeLock || e.ctrlKey || scrolls(e.target, e.deltaX)) return
    swipe = now - swipeAt > 150 ? e.deltaX : swipe + e.deltaX; swipeAt = now
    if (Math.abs(swipe) > 100) {
      const dir = swipe < 0 ? 'back' : 'forward'; swipeLock = now + 800; swipe = 0
      ipcRenderer.invoke('swipe-nav', dir).then(ok => { if (ok) { const out = slide(dir, true); setTimeout(() => out?.cancel(), 600) } }) // the cancel covers same-document navigations
    }
  }, { passive: true })
  // very discreet: the old page slips a few pixels away while fading, the new one slips in
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const slide = (dir, out) => {
    if (reduced.matches) return
    const x = (dir === 'back' ? 14 : -14) * (out ? 1 : -1), away = { opacity: 0.4, transform: `translateX(${x}px)` }, here = { opacity: 1, transform: 'none' }
    return document.documentElement.animate(out ? [here, away] : [away, here], { duration: out ? 120 : 200, easing: 'ease-out', fill: out ? 'forwards' : 'none' })
  }
  ipcRenderer.on('swipe-in', (_, dir) => slide(dir, false))
}

// fingerprint protection: every visitor reports the same common hardware, and the page can't tell it's a plain Chrome
if (process.argv.includes('--heliarc-fp') && ipcRenderer.sendSync('fp:site')) {
  require('electron').contextBridge.executeInMainWorld({ func: () => {
    for (const [k, v] of [['hardwareConcurrency', 4], ['deviceMemory', 8]]) try { Object.defineProperty(Navigator.prototype, k, { get: () => v, configurable: true }) } catch {}
    // Electron leaves window.chrome empty, Chrome doesn't
    const t = performance.timeOrigin / 1000, c = window.chrome ||= {}
    c.app ||= { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }, getDetails: () => null, getIsInstalled: () => false }
    c.csi ||= () => ({ startE: Math.round(t * 1000), onloadT: Date.now(), pageT: performance.now(), tran: 15 })
    c.loadTimes ||= () => ({ requestTime: t, startLoadTime: t, commitLoadTime: t, finishDocumentLoadTime: t, finishLoadTime: t, firstPaintTime: t, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' })
    // Google sign-in refuses browsers whose brands don't include "Google Chrome"
    const uad = navigator.userAgentData, P = window.NavigatorUAData?.prototype
    if (uad && P) {
      const chrome = b => { const c = b.find(x => x.brand === 'Chromium'); return c && !b.some(x => x.brand === 'Google Chrome') ? [...b, { ...c, brand: 'Google Chrome' }] : b }
      const brands = Object.getOwnPropertyDescriptor(P, 'brands').get, high = P.getHighEntropyValues
      Object.defineProperty(P, 'brands', { get() { return chrome(brands.call(this)) }, configurable: true })
      P.getHighEntropyValues = function (h) { return high.call(this, h).then(r => (r.brands && (r.brands = chrome(r.brands)), r.fullVersionList && (r.fullVersionList = chrome(r.fullVersionList)), r)) }
    }
  } })
}
