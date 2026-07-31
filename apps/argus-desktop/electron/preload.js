const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDefaultDirectory: () => ipcRenderer.invoke('get-default-directory'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  writeFile: (dirPath, relativePath, content) => ipcRenderer.invoke('write-file', { dirPath, relativePath, content }),
  readFile: (dirPath, relativePath) => ipcRenderer.invoke('read-file', { dirPath, relativePath }),
  deleteFile: (dirPath, relativePath) => ipcRenderer.invoke('delete-file', { dirPath, relativePath }),
  gitCheckUpdates: () => ipcRenderer.invoke('git-check-updates'),
  gitPullAndBuild: () => ipcRenderer.invoke('git-pull-and-build'),
  appReload: () => ipcRenderer.invoke('app-reload'),
  listSystemDirectory: (targetPath) => ipcRenderer.invoke('list-system-directory', targetPath),
  readSystemFile: (filePath) => ipcRenderer.invoke('read-system-file', filePath),
  writeSystemFile: (filePath, content) => ipcRenderer.invoke('write-system-file', { filePath, content }),
  deleteSystemFile: (filePath) => ipcRenderer.invoke('delete-system-file', filePath),
  moveSystemFile: (sourcePath, destinationPath) => ipcRenderer.invoke('move-system-file', { sourcePath, destinationPath }),
});
