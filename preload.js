const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  call: (n, ...a) => ipcRenderer.invoke(n, ...a),
  onState: f => { ipcRenderer.on('state', (_, s) => f(s)); ipcRenderer.invoke('ready') },
  onOpen: f => ipcRenderer.on('open', (_, o) => f(o)),
  on: (ch, f) => ipcRenderer.on(ch, (_, o) => f(o)),
})
