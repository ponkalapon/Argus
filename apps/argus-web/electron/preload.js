const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDefaultDirectory: () => ipcRenderer.invoke('get-default-directory'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  writeFile: (dirPath, relativePath, content) => ipcRenderer.invoke('write-file', { dirPath, relativePath, content }),
  readFile: (dirPath, relativePath) => ipcRenderer.invoke('read-file', { dirPath, relativePath }),
  deleteFile: (dirPath, relativePath) => ipcRenderer.invoke('delete-file', { dirPath, relativePath }),
});
