import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bridge', {
  openUi: () => ipcRenderer.invoke('open-ui'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getPorts: () => ipcRenderer.invoke('get-ports'),
  hide: () => ipcRenderer.invoke('hide'),
  quit: () => ipcRenderer.invoke('quit'),
  onStatus: (cb: (status: Record<string, boolean>) => void) =>
    ipcRenderer.on('status', (_e, s) => cb(s)),
  onReady: (cb: (ports: { uiPort: number; bridgePort: number }) => void) =>
    ipcRenderer.on('ready', (_e, p) => cb(p)),
  onLog: (cb: (line: string) => void) =>
    ipcRenderer.on('log', (_e, l) => cb(l)),
});
