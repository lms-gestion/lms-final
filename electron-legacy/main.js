const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const dataPath = path.join(app.getPath('userData'), 'lms-data.json')

function loadData() {
  try { if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, 'utf8')) } catch(e) {}
  return { chantiers:[], clients:[], techniciens:[], fournisseurs:[], factures:[], imports:[], columns:[] }
}
function saveData(d) {
  try { fs.writeFileSync(dataPath, JSON.stringify(d, null, 2), 'utf8'); return true } catch(e) { return false }
}

let win
function createWindow() {
  win = new BrowserWindow({
    width:1440, height:900, minWidth:1100, minHeight:700,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration:false, contextIsolation:true },
    title:'LMS Gestion — La Maison des Services',
    show:false, backgroundColor:'#f0f5fb'
  })
  win.loadFile(path.join(__dirname, 'src', 'index.html'))
  win.once('ready-to-show', () => { win.show(); win.maximize() })
}
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

ipcMain.handle('data:load', () => loadData())
ipcMain.handle('data:save', (_, d) => saveData(d))
ipcMain.handle('dialog:openFile', async () => dialog.showOpenDialog(win, {
  properties: ['openFile','multiSelections'],
  filters: [{ name:'Documents', extensions:['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','zip','txt'] }]
}))
