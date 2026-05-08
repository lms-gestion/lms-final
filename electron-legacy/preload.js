const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('lmsAPI', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (d) => ipcRenderer.invoke('data:save', d),
  openFile: () => ipcRenderer.invoke('dialog:openFile')
})
