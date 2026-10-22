// Customizable keyboard shortcuts. "Mod" is Cmd on macOS and Ctrl elsewhere.
const MAC = process.platform === 'darwin'
const ACTIONS = {
  newTab: ['New tab', 'Mod+T'], newPrivateTab: ['New private tab', 'Mod+Shift+N'], editAddress: ['Edit address', 'Mod+L'], copyLink: ['Copy page link', 'Mod+Shift+C'], closeTab: ['Close tab', 'Mod+W'], reload: ['Reload', 'Mod+R'],
  find: ['Find in page', 'Mod+F'], zoomIn: ['Zoom in', 'Mod+='], zoomOut: ['Zoom out', 'Mod+-'], zoomReset: ['Actual size', 'Mod+0'],
  toggleSidebar: ['Collapse sidebar', 'Mod+S'], splitView: ['Split view', 'Mod+Shift+S'], library: ['Library (downloads, archive)', MAC ? 'Mod+Shift+J' : 'Mod+J'],
  history: ['History', MAC ? 'Mod+Y' : 'Mod+H'], settings: ['Settings', 'Mod+,'], print: ['Print', 'Mod+P'], devtools: ['Developer tools', 'Mod+Shift+I'],
}
const MODS = ['Control', 'Shift', 'Alt', 'Meta']

// Normalized combo for a keyboard event ({key, control, meta, alt, shift}), e.g. "Mod+Shift+S"; null for a lone modifier key.
function combo(i, mac = MAC) {
  if (MODS.includes(i.key)) return null
  let k = i.key.length === 1 ? i.key.toUpperCase() : i.key, shift = i.shift
  if (/^Digit\d$/.test(i.code)) k = i.code[5] // AZERTY types "à" for the 0 key: shortcuts follow the key's place, not what it types
  if (k === '+') { k = '='; shift = false } // Ctrl+Shift+= types "+": same zoom-in key
  return [(mac ? i.meta : i.control) && 'Mod', mac && i.control && 'Ctrl', i.alt && 'Alt', shift && 'Shift', k].filter(Boolean).join('+')
}
// A usable shortcut needs a modifier (Mod/Ctrl/Alt) or is a function key; plain keys would break typing.
const valid = c => /^F\d{1,2}$/.test(c) || c.split('+').some(p => ['Mod', 'Ctrl', 'Alt'].includes(p))
const resolve = custom => Object.fromEntries(Object.entries(ACTIONS).map(([a, [, d]]) => [a, custom?.[a] ?? d]))
const actionFor = (keys, c) => c === 'F12' ? 'devtools' : Object.keys(keys).find(a => keys[a] === c)
module.exports = { ACTIONS, combo, valid, resolve, actionFor }
