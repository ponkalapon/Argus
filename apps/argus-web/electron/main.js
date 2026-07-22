const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

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
