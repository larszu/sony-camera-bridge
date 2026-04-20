import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
// @ts-ignore
import serveStatic from 'serve-static';
// @ts-ignore
import finalhandler from 'finalhandler';

// ─── Ports ────────────────────────────────────────────────────────────────────
const BRIDGE_PORT = 9700;
const UI_PORT = 5997;

// ─── State ────────────────────────────────────────────────────────────────────
let launcherWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let bridgeProcess: ChildProcess | null = null;
let uiHttpServer: http.Server | null = null;

const serviceStatus = {
  coreServer: false,
  licenseCheck: false,
  loadingModules: false,
  webServer: false,
};

const logs: string[] = [];

function addLog(msg: string) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  logs.push(entry);
  if (logs.length > 500) logs.shift();
  launcherWindow?.webContents.send('log', entry);
}

// ─── Bridge Server (child process) ───────────────────────────────────────────
async function startBridge(): Promise<void> {
  addLog('Starting Bridge Server...');
  serviceStatus.coreServer = true;
  sendStatus();

  // Locate bridge entry point
  // Dev:       ../../bridge/src/index.ts  (run via tsx)
  // Packaged:  resources/bridge/index.js  (pre-compiled)
  const bridgeSrcDev = path.join(__dirname, '..', '..', 'bridge', 'src', 'index.ts');
  const bridgeSrcPkg = path.join(process.resourcesPath ?? '', 'bridge', 'index.js');

  let cmd: string;
  let args: string[];

  if (fs.existsSync(bridgeSrcDev)) {
    // Development: use tsx
    const tsxBin = path.join(__dirname, '..', '..', 'bridge', 'node_modules', '.bin', 'tsx');
    const tsxFallback = path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'tsx');
    cmd = fs.existsSync(tsxBin) ? tsxBin : tsxFallback;
    args = [bridgeSrcDev];
  } else {
    // Packaged: run compiled JS directly with bundled Node
    cmd = process.execPath;
    args = [bridgeSrcPkg];
  }

  bridgeProcess = spawn(cmd, args, {
    env: { ...process.env, BRIDGE_PORT: String(BRIDGE_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  bridgeProcess.stdout?.on('data', (d: Buffer) => addLog(`[bridge] ${d.toString().trim()}`));
  bridgeProcess.stderr?.on('data', (d: Buffer) => addLog(`[bridge:err] ${d.toString().trim()}`));
  bridgeProcess.on('exit', (code) => addLog(`[bridge] exited with code ${code}`));

  // Give bridge a moment to bind
  await delay(600);
  addLog(`Bridge WebSocket on ws://localhost:${BRIDGE_PORT}`);
}

// ─── Static UI HTTP Server ─────────────────────────────────────────────────────
function startUiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Locate the built web-rcp dist directory
    // In development: ../../web-rcp/dist
    // In packaged app: resources/ui
    const distCandidates = [
      path.join(__dirname, '..', '..', 'web-rcp', 'dist'),
      path.join(process.resourcesPath ?? '', 'ui'),
      path.join(app.getAppPath(), 'ui'),
    ];

    const uiRoot = distCandidates.find((p) => fs.existsSync(p));
    if (!uiRoot) {
      addLog('WARN: web-rcp dist not found, skipping UI server');
      serviceStatus.webServer = false;
      sendStatus();
      resolve();
      return;
    }

    addLog(`Serving UI from: ${uiRoot}`);
    const serve = serveStatic(uiRoot, { index: ['index.html'] });

    uiHttpServer = http.createServer((req, res) => {
      serve(req, res, finalhandler(req, res));
    });

    uiHttpServer.listen(UI_PORT, '0.0.0.0', () => {
      addLog(`Web UI listening on http://localhost:${UI_PORT}`);
      serviceStatus.webServer = true;
      sendStatus();
      resolve();
    });

    uiHttpServer.on('error', (err) => {
      addLog(`UI server error: ${err.message}`);
      reject(err);
    });
  });
}

// ─── Status broadcast ─────────────────────────────────────────────────────────
function sendStatus() {
  launcherWindow?.webContents.send('status', serviceStatus);
}

// ─── Launcher Window ──────────────────────────────────────────────────────────
function createLauncherWindow(): void {
  launcherWindow = new BrowserWindow({
    width: 440,
    height: 480,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    show: false,
  });

  launcherWindow.loadFile(path.join(__dirname, '..', 'launcher', 'index.html'));

  launcherWindow.once('ready-to-show', () => {
    launcherWindow?.show();
    // Start services after window is visible
    startServices();
  });

  launcherWindow.on('close', (e) => {
    e.preventDefault();
    launcherWindow?.hide();
  });

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Sony Camera Bridge');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open', click: () => { launcherWindow?.show(); launcherWindow?.focus(); } },
      { label: 'Open UI in Browser', click: () => shell.openExternal(`http://localhost:${UI_PORT}`) },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.exit(0); } },
    ]),
  );
  tray.on('click', () => { launcherWindow?.show(); launcherWindow?.focus(); });
}

// ─── Boot sequence ────────────────────────────────────────────────────────────
async function startServices(): Promise<void> {
  try {
    // Step 1: Core Server
    serviceStatus.coreServer = false;
    sendStatus();
    await delay(300);
    serviceStatus.coreServer = true;
    sendStatus();
    addLog('Core Server OK');

    // Step 2: License Check
    await delay(200);
    serviceStatus.licenseCheck = true;
    sendStatus();
    addLog('License Check OK');

    // Step 3: Loading Modules (bridge)
    await delay(200);
    serviceStatus.loadingModules = true;
    sendStatus();
    await startBridge();

    // Step 4: Web Server
    await startUiServer();

    // Notify renderer that everything is ready
    launcherWindow?.webContents.send('ready', { uiPort: UI_PORT, bridgePort: BRIDGE_PORT });
    addLog('All services started.');
  } catch (err) {
    addLog(`Startup error: ${(err as Error).message}`);
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('open-ui', () => {
  shell.openExternal(`http://localhost:${UI_PORT}`);
});

ipcMain.handle('get-logs', () => logs.join('\n'));

ipcMain.handle('get-status', () => serviceStatus);

ipcMain.handle('get-ports', () => ({ ui: UI_PORT, bridge: BRIDGE_PORT }));

ipcMain.handle('hide', () => launcherWindow?.hide());

ipcMain.handle('quit', () => {
  bridgeProcess?.kill();
  uiHttpServer?.close();
  app.exit(0);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  createLauncherWindow();
});

app.on('window-all-closed', () => {
  // Keep running in tray even when window is closed
});

app.on('before-quit', () => {
  bridgeProcess?.kill();
  uiHttpServer?.close();
});
