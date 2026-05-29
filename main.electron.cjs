const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU cache to prevent Access Denied cache creation errors in restricted/admin environments
app.commandLine.appendSwitch('disable-gpu-cache');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Apex Solutions",
    backgroundColor: '#151720',
    frame: false, // Frameless window to blend seamlessly into the operating system
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Native IPC bindings for frameless window operations
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  // Enable troubleshooting hotkeys only in development or explicitly opted-in builds.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const devToolsEnabled =
      process.env.NODE_ENV === 'development' || process.env.APEX_ENABLE_DEVTOOLS === 'true';
    if (!devToolsEnabled) return;

    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });

  // In production, we load from the local backend server which serves the static files
  const startUrl = 'http://localhost:3000';
  
  const maxLoadAttempts = Number(process.env.APEX_ELECTRON_LOAD_ATTEMPTS || 80);
  let loadAttempts = 0;

  const showLoadFailurePage = (message) => {
    if (!mainWindow) return;
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Apex Solutions Startup Error</title>
          <style>
            body { margin: 0; font-family: system-ui, sans-serif; background: #151720; color: #e2e8f0; display: grid; min-height: 100vh; place-items: center; }
            main { max-width: 560px; padding: 32px; }
            h1 { font-size: 22px; margin: 0 0 12px; }
            p { color: #94a3b8; line-height: 1.6; }
            code { color: #a5b4fc; }
          </style>
        </head>
        <body>
          <main>
            <h1>Apex Solutions could not start the local core.</h1>
            <p>The desktop shell tried ${maxLoadAttempts} times to reach <code>${startUrl}</code> and stopped retrying.</p>
            <p>${message}</p>
          </main>
        </body>
      </html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  };

  const loadWithRetry = () => {
    if (!mainWindow) return;
    mainWindow.loadURL(startUrl).catch((err) => {
      loadAttempts += 1;
      if (loadAttempts >= maxLoadAttempts) {
        console.error("Express core server failed to become ready:", err.message);
        showLoadFailurePage(err.message);
        return;
      }
      console.warn(`Express core server is not ready yet. Retry ${loadAttempts}/${maxLoadAttempts} in 500ms...`, err.message);
      setTimeout(loadWithRetry, 500);
    });
  };
  loadWithRetry();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  try {
    // Explicitly enforce production runtime environment variables for in-process server
    process.env.NODE_ENV = 'production';
    process.env.PORT = '3000';
    const runtimeDir = path.join(app.getPath('userData'), 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    process.env.APEX_RUNTIME_DIR = runtimeDir;

    // Elegant, zero-dependency in-process require to run express server in main electron thread
    require(path.join(__dirname, 'dist', 'server.cjs'));
    console.log("Embedded Express core server successfully initialized in Electron main thread.");
  } catch (err) {
    console.error("Failed to boot embedded Express server:", err);
  }
}

app.whenReady().then(() => {
  // Always start the system core server if not in dev mode (dev mode uses its own process)
  if (process.env.NODE_ENV !== 'development') {
    startServer();
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
