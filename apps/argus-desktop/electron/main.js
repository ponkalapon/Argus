const { app, BrowserWindow, protocol, session, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const url = require('url');
const fs = require('fs');

function getGitRootDir() {
  const candidates = [
    path.join(__dirname, '../..'),
    path.join(__dirname, '..'),
    process.cwd(),
    app.getAppPath(),
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
  }
  return candidates[0] || process.cwd();
}

async function fetchGitHubCommits() {
  try {
    const res = await fetch('https://api.github.com/repos/ponkalapon/Argus/commits?per_page=10', {
      headers: { 'User-Agent': 'ArgusApp/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((c) => {
      const sha = c.sha ? c.sha.slice(0, 7) : '';
      const msg = c.commit?.message ? c.commit.message.split('\n')[0] : '';
      return `${sha} ${msg}`;
    });
  } catch {
    return [];
  }
}

ipcMain.handle('git-check-updates', async () => {
  const projectRoot = getGitRootDir();
  const hasGit = fs.existsSync(path.join(projectRoot, '.git'));

  if (hasGit) {
    return new Promise((resolve) => {
      exec('git fetch origin && git log HEAD..origin/main --oneline -n 15', { cwd: projectRoot }, async (err, stdout) => {
        if (err) {
          // If local fetch fails (e.g. offline or no remote), check GitHub API
          const remoteCommits = await fetchGitHubCommits();
          resolve({
            available: remoteCommits.length > 0,
            commitCount: remoteCommits.length,
            commits: remoteCommits.length > 0 ? remoteCommits : ['Связаться с GitHub не удалось'],
            error: null,
          });
          return;
        }
        const lines = stdout.trim().split('\n').filter(Boolean);
        resolve({
          available: lines.length > 0,
          commitCount: lines.length,
          commits: lines,
          error: null,
        });
      });
    });
  }

  // Standalone mode without .git folder: fetch from GitHub API directly
  const remoteCommits = await fetchGitHubCommits();
  return {
    available: remoteCommits.length > 0,
    commitCount: remoteCommits.length,
    commits: remoteCommits,
    isStandalone: true,
    error: null,
  };
});

ipcMain.handle('git-pull-and-build', async () => {
  const projectRoot = getGitRootDir();
  const appDir = fs.existsSync(path.join(projectRoot, 'apps/argus-desktop'))
    ? path.join(projectRoot, 'apps/argus-desktop')
    : path.join(__dirname, '..');

  const hasGit = fs.existsSync(path.join(projectRoot, '.git'));

  return new Promise((resolve) => {
    // If .git folder does not exist, initialize git repository and set remote URL
    const gitCmd = hasGit
      ? 'git pull origin main'
      : 'git init && git remote add origin https://github.com/ponkalapon/Argus.git && git fetch origin main && git checkout -B main origin/main';

    exec(gitCmd, { cwd: projectRoot }, (errPull, stdoutPull) => {
      if (errPull) {
        // Try fallback with set-url if remote already exists
        const fallbackCmd = 'git remote set-url origin https://github.com/ponkalapon/Argus.git && git fetch origin main && git reset --hard origin/main';
        exec(fallbackCmd, { cwd: projectRoot }, (errFallback, stdoutFallback) => {
          if (errFallback) {
            resolve({
              success: false,
              built: false,
              log: `Не удалось инициализировать Git репозиторий: ${errFallback.message.split('\n')[0]}`,
            });
            return;
          }
          runBuild(appDir, stdoutFallback, resolve);
        });
        return;
      }
      runBuild(appDir, stdoutPull, resolve);
    });
  });
});

function runBuild(appDir, pullLog, resolve) {
  const cleanPullLog = (pullLog || '').trim();
  const summaryLog = cleanPullLog ? `Результат Git:\n${cleanPullLog}` : 'Код успешно синхронизирован с GitHub!';

  if (!fs.existsSync(path.join(appDir, 'package.json'))) {
    resolve({
      success: true,
      built: false,
      log: `✓ Обновление из GitHub успешно выполнено!\n\n${summaryLog}\n\nНажмите «Перезапустить приложение» для применения изменений.`,
    });
    return;
  }

  exec('npm run build', { cwd: appDir }, (errBuild, stdoutBuild) => {
    if (errBuild) {
      // NPM is not installed or build skipped (normal on end-user PCs without Node.js)
      resolve({
        success: true,
        built: false,
        log: `✓ Свежие обновления успешно подтянуты из GitHub!\n\n${summaryLog}\n\nНажмите «Перезапустить приложение» для применения изменений.`,
      });
      return;
    }
    resolve({
      success: true,
      built: true,
      log: `✓ Обновление успешно выполнено и собрано локально!\n\n${summaryLog}\n${stdoutBuild ? stdoutBuild.slice(0, 300) : ''}`,
    });
  });
}

ipcMain.handle('app-reload', async () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.reload();
});




ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-default-directory', async () => {
  try {
    const downloads = app.getPath('downloads');
    const defaultFolder = path.join(downloads, 'ArgusProjects');
    if (!fs.existsSync(defaultFolder)) {
      fs.mkdirSync(defaultFolder, { recursive: true });
    }
    return defaultFolder;
  } catch {
    return null;
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  const results = [];

  const readFolder = (currentDir, baseDir) => {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          readFolder(fullPath, baseDir);
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size < 5 * 1024 * 1024) {
              const content = fs.readFileSync(fullPath, 'utf8');
              results.push({ path: relPath, content, size: stat.size });
            }
          } catch {}
        }
      }
    } catch {}
  };

  readFolder(dirPath, dirPath);
  return results;
});

ipcMain.handle('write-file', async (event, { dirPath, relativePath, content }) => {
  if (!dirPath || !relativePath) return false;
  try {
    const fullPath = path.join(dirPath, relativePath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing file:', e);
    return false;
  }
});

ipcMain.handle('read-file', async (event, { dirPath, relativePath }) => {
  try {
    const fullPath = path.join(dirPath, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('delete-file', async (event, { dirPath, relativePath }) => {
  try {
    const fullPath = path.join(dirPath, relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch {}
  return false;
});

const logFile = path.join(app.getPath('userData'), 'app_debug.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  console.log(msg);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function createWindow() {
  log('Creating BrowserWindow...');
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.on('did-fail-load', (e, code, desc, validatedUrl) => {
    log(`did-fail-load: code=${code}, desc=${desc}, url=${validatedUrl}`);
  });

  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    log(`Console[${level}]: ${message} (${sourceId}:${line})`);
  });

  // Open DevTools automatically to diagnose black screen
  // win.webContents.openDevTools();

  if (process.env.ELECTRON_START_URL) {
    log(`Loading ELECTRON_START_URL: ${process.env.ELECTRON_START_URL}`);
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    log('Loading app://local/index.html');
    win.loadURL('app://local/index.html');
  }
}

app.whenReady().then(() => {
  log('App ready. Setting up protocol handler...');

  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  if (session.defaultSession) {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      delete details.requestHeaders['Origin'];
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      callback({ requestHeaders: details.requestHeaders });
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      delete responseHeaders['access-control-allow-origin'];
      delete responseHeaders['Access-Control-Allow-Origin'];
      responseHeaders['access-control-allow-origin'] = ['*'];
      responseHeaders['access-control-allow-headers'] = ['*'];
      responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
      callback({ responseHeaders });
    });
  }
  protocol.handle('app', (request) => {
    try {
      const parsed = new url.URL(request.url);
      let pathname = decodeURIComponent(parsed.pathname);
      log(`Protocol request: url=${request.url}, rawPath=${pathname}`);

      const relativePath = pathname.replace(/^[\/\\]+/, '');
      const distPath = path.join(__dirname, '../dist');
      const filePath = path.join(distPath, relativePath || 'index.html');

      log(`Mapped filePath: ${filePath}`);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const mimeType = getMimeType(filePath);
        const data = fs.readFileSync(filePath);
        log(`Serving file ${filePath} (${data.length} bytes, ${mimeType})`);
        return new Response(data, {
          headers: { 'content-type': mimeType },
        });
      } else {
        log(`File NOT found: ${filePath}`);
      }
    } catch (e) {
      log(`App protocol error: ${e.stack || e}`);
    }

    try {
      const indexPath = path.join(__dirname, '../dist/index.html');
      log(`Fallback serving index.html from ${indexPath}`);
      const data = fs.readFileSync(indexPath);
      return new Response(data, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    } catch (e) {
      log(`Fatal index.html fallback error: ${e.stack || e}`);
      return new Response('Fatal Error: index.html not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
