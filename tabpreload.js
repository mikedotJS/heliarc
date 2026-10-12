// Runs inside every web page (isolated world): detects logins to offer saving them, and fills saved logins / profile on focus.
const { ipcRenderer } = require('electron')
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
  if (b && (b.type === 'submit' || LOGIN.test(b.innerText || b.value || b.getAttribute('aria-label') || ''))) capture(scope(b))
}, true)

// Chrome Web Store: its own "Add to Chrome" button stays disabled outside Chrome, so turn it into a working "Add to Heliarc".
if (location.hostname === 'chromewebstore.google.com') {
  const say = (b, t) => { b.textContent = t }
  const swap = () => (document.querySelector('[jsname=gQ2Xie]')?.click(), document.querySelectorAll('button[disabled][class*="UywwFc-LgbsSe"]').forEach(b => {
    b.disabled = false; say(b, 'Add to Heliarc'); if (b.dataset.heliarc) return
    b.dataset.heliarc = '1'
    b.addEventListener('click', async e => {
      e.stopImmediatePropagation(); e.preventDefault(); if (!e.isTrusted || b.dataset.busy) return
      b.dataset.busy = '1'; say(b, 'Adding…')
      const r = await ipcRenderer.invoke('ext:install', location.href).catch(err => ({ error: err.message }))
      delete b.dataset.busy; say(b, r.error ? 'Retry — ' + r.error.slice(0, 60) : '✓ Added to Heliarc')
    }, true)
  }))
  addEventListener('DOMContentLoaded', () => { swap(); new MutationObserver(swap).observe(document.body, { childList: true, subtree: true }) })
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