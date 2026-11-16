// Runs in every service worker (in its own realm: no `location` or `self` here). Chrome tells an extension when it has just been installed or updated
// (most set themselves up then: welcome page, right-click menus) and when the browser starts (some resume their session then); Electron never does,
// so an extension's worker asks main.js as it starts, and hears what Chrome would have told it once its own code has set its listeners.
const { ipcRenderer, contextBridge } = require('electron')
ipcRenderer.invoke('ext:runtime').then(evs => evs?.length && contextBridge.executeInMainWorld({ func: evs => { for (const [name, d] of evs) chrome.runtime[name].dispatch(...(d ? [d] : [])) }, args: [evs] })).catch(() => {}) // a website's worker has no answer
