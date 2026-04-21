import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function resolveUiEntry(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'web-rcp', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'ui', 'index.html'),
    path.join(app.getAppPath(), 'ui', 'index.html'),
  ];

  const uiEntry = candidates.find((candidate) => fs.existsSync(candidate));
  if (!uiEntry) {
    throw new Error('Bundled web UI not found. Build packages/web-rcp first.');
  }

  return uiEntry;
}

function createMainWindow(): void {
  const uiEntry = resolveUiEntry();

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#101214',
    autoHideMenuBar: true,
    show: false,
    title: 'Sony Camera Bridge',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  mainWindow.loadFile(uiEntry);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
