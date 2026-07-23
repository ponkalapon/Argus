import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('argus', {
  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Projects
  loadProjects: () => ipcRenderer.invoke('projects:load'),
  saveProjects: (projects: { path: string; name: string }[]) => ipcRenderer.invoke('projects:save', projects),

  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  loadApiKey: () => ipcRenderer.invoke('settings:loadApiKey'),
  saveApiKey: (key: string) => ipcRenderer.invoke('settings:saveApiKey', key),

  // Filesystem
  listFiles: (projectPath: string) => ipcRenderer.invoke('fs:listFiles', projectPath),
  readFile: (projectPath: string, filePath: string) => ipcRenderer.invoke('fs:readFile', projectPath, filePath),
  writeFile: (projectPath: string, filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', projectPath, filePath, content),
  getProjectName: (projectPath: string) => ipcRenderer.invoke('fs:getProjectName', projectPath),

  // Chats
  loadChats: (projectPath: string) => ipcRenderer.invoke('chats:load', projectPath),
  saveChats: (projectPath: string, chats: any[]) => ipcRenderer.invoke('chats:save', projectPath, chats),

  // Navigation events
  onNavigate: (callback: (screen: string) => void) => {
    ipcRenderer.on('navigate', (_, screen) => callback(screen));
  },
});
