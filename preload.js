const { contextBridge, ipcRenderer } = require('electron')
if (location.pathname.endsWith('/arc.html')) require('electron-chrome-extensions/browser-action').injectBrowserAction() // the sidebar's <browser-action-list>
contextBridge.exposeInMainWorld('api', {
  call: (n, ...a) => ipcRenderer.invoke(n, ...a),
  onState: f => { ipcRenderer.on('state', (_, s) => f(s)); ipcRenderer.invoke('ready') },
  onOpen: f => ipcRenderer.on('open', (_, o) => f(o)),
  on: (ch, f) => ipcRenderer.on(ch, (_, o) => f(o)),
})
