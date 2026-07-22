import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

let mainWindow: BrowserWindow | null = null;

const SETTINGS_DIR = path.join(os.homedir(), '.argus-desktop');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');
const PROJECTS_FILE = path.join(SETTINGS_DIR, 'projects.json');

function ensureDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return fallback;
}

function saveJson(filePath: string, data: any) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Argus',
      submenu: [
        { label: 'Настройки', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('navigate', 'settings') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC Handlers ──

function registerIpcHandlers() {
  // Dialog: select folder
  ipcMain.handle('dialog:selectFolder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Выбери папку проекта',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Projects management
  ipcMain.handle('projects:load', () => {
    return loadJson<{ path: string; name: string }[]>(PROJECTS_FILE, []);
  });

  ipcMain.handle('projects:save', (_, projects: { path: string; name: string }[]) => {
    saveJson(PROJECTS_FILE, projects);
    return true;
  });

  // Settings
  ipcMain.handle('settings:load', () => {
    return loadJson(SETTINGS_FILE, {
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      allowAssistantContacts: false,
      internetEnabled: false,
      apiFormat: 'openai',
      language: 'ru',
    });
  });

  ipcMain.handle('settings:save', (_, settings: any) => {
    saveJson(SETTINGS_FILE, settings);
    return true;
  });

  ipcMain.handle('settings:loadApiKey', () => {
    const keyFile = path.join(SETTINGS_DIR, 'apikey.txt');
    try {
      return fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf-8') : '';
    } catch { return ''; }
  });

  ipcMain.handle('settings:saveApiKey', (_, key: string) => {
    const keyFile = path.join(SETTINGS_DIR, 'apikey.txt');
    ensureDir();
    fs.writeFileSync(keyFile, key, 'utf-8');
    return true;
  });

  // Filesystem
  ipcMain.handle('fs:listFiles', (_, projectPath: string) => {
    const IGNORE = ['node_modules', '.git', '.argus', 'dist', '__pycache__', '.next', '.venv', 'venv'];
    const result: { path: string; name: string; isDir: boolean; size: number }[] = [];

    function walk(dir: string, rel: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (IGNORE.includes(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            result.push({ path: relPath, name: entry.name, isDir: true, size: 0 });
            walk(fullPath, relPath);
          } else {
            const stat = fs.statSync(fullPath);
            result.push({ path: relPath, name: entry.name, isDir: false, size: stat.size });
          }
        }
      } catch { /* skip inaccessible */ }
    }

    walk(projectPath, '');
    return result;
  });

  ipcMain.handle('fs:readFile', (_, projectPath: string, filePath: string) => {
    const fullPath = path.join(projectPath, filePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(projectPath))) return { error: 'Path traversal blocked' };
    try {
      return { content: fs.readFileSync(fullPath, 'utf-8') };
    } catch (e: any) {
      return { error: e.message };
    }
  });

  ipcMain.handle('fs:writeFile', (_, projectPath: string, filePath: string, content: string) => {
    const fullPath = path.join(projectPath, filePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(projectPath))) return { error: 'Path traversal blocked' };
    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true };
    } catch (e: any) {
      return { error: e.message };
    }
  });

  // Chats per project
  ipcMain.handle('chats:load', (_, projectPath: string) => {
    const chatsDir = path.join(projectPath, '.argus');
    const chatsFile = path.join(chatsDir, 'chats.json');
    if (!fs.existsSync(chatsFile)) return [];
    try {
      return JSON.parse(fs.readFileSync(chatsFile, 'utf-8'));
    } catch { return []; }
  });

  ipcMain.handle('chats:save', (_, projectPath: string, chats: any[]) => {
    const chatsDir = path.join(projectPath, '.argus');
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });
    const chatsFile = path.join(chatsDir, 'chats.json');
    fs.writeFileSync(chatsFile, JSON.stringify(chats, null, 2), 'utf-8');
    return true;
  });

  ipcMain.handle('fs:getProjectName', (_, projectPath: string) => {
    return path.basename(projectPath);
  });
}

// ── App lifecycle ──

app.whenReady().then(() => {
  ensureDir();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
