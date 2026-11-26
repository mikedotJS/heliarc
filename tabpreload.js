// Runs inside every web page (isolated world): detects logins to offer saving them, and fills saved logins / profile on focus.
const { ipcRenderer, contextBridge } = require('electron')
if (location.protocol === 'file:' && location.pathname.endsWith('/ui/system.html')) contextBridge.exposeInMainWorld('sys', { trust: () => ipcRenderer.invoke('sys:trust'), unblock: () => ipcRenderer.invoke('sys:unblock'), pause: () => ipcRenderer.invoke('sys:pause') }) // the invalid-certificate screen's "Continue anyway", the blocked-site screen's "Unblock" and "Pause 5 min"
// a link aimed at a named window (target=_new, target=foo) is an ordinary "new tab" link: it goes out as target=_blank, so a same-site one stays in this tab like the others
// (window.open(url, name) is left alone: the page may need its link to that window)
addEventListener('click', e => { const a = e.target.closest?.('a[target][href]'), t = a?.target; if (!t || /^_(blank|self|top|parent)$/i.test(t) || document.querySelector(`iframe[name="${CSS.escape(t)}"]`)) return; a.target = '_blank'; setTimeout(() => { a.target = t }) })
const PROFILE = { email: 'email', tel: 'phone', 'given-name': 'first', 'family-name': 'last', name: 'name', organization: 'org', 'street-address': 'street', 'address-line1': 'street', 'postal-code': 'zip', 'address-level2': 'city', 'country-name': 'country' }
const LOGIN = /log ?in|sign ?in|sign ?up|continue|submit|next|connexion|connecter|identifier|valider/i
const visible = el => { // what the user can really see: shown, opaque, not clipped away, and on screen (a trap form hides fields off screen)
  if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || (s => s.clip !== 'auto' || s.clipPath !== 'none')(getComputedStyle(el))) return false
  let r = el.getBoundingClientRect(), x1 = Math.max(r.left, 0), y1 = Math.max(r.top, 0), x2 = Math.min(r.right, innerWidth), y2 = Math.min(r.bottom, innerHeight)
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') { const c = a.getBoundingClientRect(); x1 = Math.max(x1, c.left); y1 = Math.max(y1, c.top); x2 = Math.min(x2, c.right); y2 = Math.min(y2, c.bottom) }
  return x2 - x1 > 10 && y2 - y1 > 10
}
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

let sent = { key: '', at: 0 }
function capture(root) { // a click on Sign in is followed by the form's submit: the same login within 2 s is sent once
  const pass = passField(root); if (!pass?.value) return
  const user = userField(root, pass)?.value || '', key = JSON.stringify([user, pass.value]), now = Date.now()
  if (key === sent.key && now - sent.at < 2000) return
  sent = { key, at: now }; ipcRenderer.send('pw:captured', { user, pass: pass.value })
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
  const root = scope(el), pass = passField(root)
  if (el.type === 'password' || (pass && el === userField(root, pass))) { // without a password field there is no login to fill: a lone email or phone field is an address field
    if (!pass) return
    creds ??= await ipcRenderer.invoke('pw:get'); if (!creds?.length) return
    const user = userField(root, pass), c = creds.find(x => x.user === user?.value) || (!user?.value && creds[0]) // a username the site prefilled that is not saved gets no other account's password
    if (!c) return
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


// YouTube: sponsor reads and self-promotion marked on SponsorBlock are skipped once each, with a notice that can undo it
if (window === top && /(^|\.)youtube\.com$/.test(location.hostname)) {
  let id = null, segs = [], done = new Set()
  setInterval(async () => { // YouTube changes video without loading a new page
    const v = new URLSearchParams(location.search).get('v'); if (v === id) return
    id = v; segs = []; done = new Set(); if (!v) return
    const got = await ipcRenderer.invoke('sb:segments', v).catch(() => []); if (id === v) segs = got
  }, 1000)
  addEventListener('timeupdate', e => {
    const video = e.target, player = video.closest?.('#movie_player'); if (!player || player.classList.contains('ad-showing')) return
    const i = segs.findIndex(([a, b], k) => !done.has(k) && video.currentTime >= a && video.currentTime < b - 0.5); if (i < 0) return
    done.add(i); const from = video.currentTime; video.currentTime = segs[i][1]; notice(player, () => { video.currentTime = from })
  }, true)
  const notice = (player, undo) => {
    player.querySelector('.heliarc-sb')?.remove()
    const n = document.createElement('div'), b = document.createElement('button'); n.className = 'heliarc-sb'; n.textContent = 'Sponsor skipped'; b.textContent = 'Undo'
    n.style.cssText = 'position:absolute;right:12px;bottom:72px;z-index:70;display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:8px;background:rgba(15,15,15,.85);color:#fff;font:500 13px/1 Roboto,Arial,sans-serif'
    b.style.cssText = 'all:unset;cursor:pointer;color:#3ea6ff;font-weight:600'
    b.onclick = () => { undo(); n.remove() }; n.append(b); player.append(n); setTimeout(() => n.remove(), 5000)
  }
}
