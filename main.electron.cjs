const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

  // Enable dynamic developer troubleshooting hotkeys in all build packages
  mainWindow.webContents.on('before-input-event', (event, input) => {
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
  
  // Robust self-healing recursive retry loop to check server readiness and handle startup latencies
  const loadWithRetry = () => {
    if (!mainWindow) return;
    mainWindow.loadURL(startUrl).catch((err) => {
      console.warn("Express core server is not ready yet. Retrying connection in 500ms...", err.message);
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
