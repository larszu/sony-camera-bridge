/**
 * WebSocket Bridge Server
 *
 * Exposes the Sony 700PTP CCU client and RS-422 transport over WebSocket.
 * Web RCP dashboard connects here for real-time camera control.
 *
 * Message format (JSON):
 *   Client → Server:  { type: 'command', cmd: string, params: Record<string, unknown> }
 *   Server → Client:  { type: 'state', state: CameraState }
 *                     { type: 'connected', info: HandshakeInfo }
 *                     { type: 'disconnected' }
 *                     { type: 'error', message: string }
 *                     { type: 'ports', ports: string[] }
 *                     { type: 'config', config: BridgeConfig }
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { Rs422Transport } from './transport/Rs422Transport.js';
import { CcuClient, CameraState } from './protocol/CcuClient.js';
import { WiznetDiscovery, WiznetDevice, WiznetDeviceConfig } from './discovery/WiznetDiscovery.js';

export interface BridgeConfig {
  /** Connection mode: 'tcp' or 'serial' */
  connectionMode?: 'tcp' | 'serial';
  /** 700PTP TCP host */
  tcpHost?: string;
  /** 700PTP TCP port (default 7700) */
  tcpPort?: number;
  /** Serial port path for RS-422 8-pin (e.g. COM3) */
  serialPath?: string;
  /** Serial baud rate (default 38400) */
  baudRate?: number;
  ccuId?: number;
}

interface ClientMessage {
  type: 'command' | 'connect' | 'disconnect' | 'listPorts' | 'getConfig' | 'setConfig' | 'discoverWiznet' | 'configureWiznet';
  cmd?: string;
  params?: Record<string, unknown>;
  config?: BridgeConfig;
  deviceIp?: string;
  deviceConfig?: WiznetDeviceConfig;
}

export class BridgeServer {
  private wss: WebSocketServer;
  private httpServer: ReturnType<typeof createServer>;
  private ccuClient: CcuClient | null = null;
  private rs422: Rs422Transport | null = null;
  private wiznetDiscovery = new WiznetDiscovery();
  private config: BridgeConfig = {
    connectionMode: 'tcp',
    tcpHost: '192.168.1.10',
    tcpPort: 7700,
    serialPath: '',
    baudRate: 38400,
    ccuId: 0,
  };

  constructor(private readonly wsPort = 9700) {
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on('connection', (ws) => this.onClient(ws));
  }

  start(): void {
    this.httpServer.listen(this.wsPort, () => {
      console.log(`[BridgeServer] WebSocket listening on ws://localhost:${this.wsPort}`);
    });
  }

  stop(): void {
    this.ccuClient?.disconnect();
    this.rs422?.close();
    this.wss.close();
    this.httpServer.close();
  }

  // ─── WebSocket client handling ────────────────────────────────────────────

  private onClient(ws: WebSocket): void {
    console.log('[BridgeServer] Web client connected');

    // Send current state immediately on connect
    ws.send(JSON.stringify({ type: 'config', config: this.config }));
    if (this.ccuClient?.connected) {
      ws.send(JSON.stringify({ type: 'connected' }));
      ws.send(JSON.stringify({ type: 'state', state: this.ccuClient.state }));
    }

    ws.on('message', (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());
        this.handleClientMessage(ws, msg).catch((err) =>
          this.sendError(ws, (err as Error).message),
        );
      } catch {
        this.sendError(ws, 'Invalid JSON message');
      }
    });

    ws.on('close', () => console.log('[BridgeServer] Web client disconnected'));
    ws.on('error', (err) => console.error('[BridgeServer] WS error:', err));
  }

  private async handleClientMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'listPorts': {
        const ports = await Rs422Transport.listPorts();
        ws.send(JSON.stringify({ type: 'ports', ports }));
        break;
      }

      case 'getConfig':
        ws.send(JSON.stringify({ type: 'config', config: this.config }));
        break;

      case 'setConfig':
        if (msg.config) {
          this.config = { ...this.config, ...msg.config };
          this.broadcast({ type: 'config', config: this.config });
        }
        break;

      case 'connect':
        if (this.config.connectionMode === 'serial') {
          await this.connectSerial();
        } else {
          await this.connectTcp();
        }
        break;

      case 'disconnect':
        this.ccuClient?.disconnect();
        break;

      case 'command':
        if (!msg.cmd) break;
        await this.dispatchCameraCommand(ws, msg.cmd, msg.params ?? {});
        break;

      case 'discoverWiznet': {
        console.log('[BridgeServer] Scanning for WIZ108SR devices...');
        const devices = await this.wiznetDiscovery.discover();
        console.log(`[BridgeServer] Found ${devices.length} device(s)`);
        ws.send(JSON.stringify({ type: 'wiznetDevices', devices }));
        break;
      }

      case 'configureWiznet': {
        if (!msg.deviceIp || !msg.deviceConfig) {
          this.sendError(ws, 'Missing deviceIp or deviceConfig');
          break;
        }
        console.log(`[BridgeServer] Configuring WIZ108SR at ${msg.deviceIp}...`);
        const ok = await this.wiznetDiscovery.configure(msg.deviceIp, msg.deviceConfig);
        ws.send(JSON.stringify({ type: 'wiznetConfigResult', success: ok, ip: msg.deviceIp }));
        break;
      }
    }
  }

  // ─── TCP connection to CCU/RP700 ──────────────────────────────────────────

  private async connectTcp(): Promise<void> {
    this.disconnectCurrent();

    this.ccuClient = new CcuClient({
      host: this.config.tcpHost ?? '192.168.1.10',
      port: this.config.tcpPort ?? 7700,
      ccuId: this.config.ccuId ?? 0,
    });
    this.wireCcuEvents();
    await this.ccuClient.connect();
  }

  // ─── Serial connection (8-pin RS-422 direct) ──────────────────────────

  private async connectSerial(): Promise<void> {
    if (!this.config.serialPath) {
      throw new Error('No serial port configured');
    }
    this.disconnectCurrent();

    this.ccuClient = new CcuClient({
      serialPath: this.config.serialPath,
      baudRate: this.config.baudRate ?? 38400,
      ccuId: this.config.ccuId ?? 0,
    });
    this.wireCcuEvents();
    await this.ccuClient.connect();
  }

  private disconnectCurrent(): void {
    if (this.ccuClient?.connected) {
      this.ccuClient.disconnect();
    }
    this.ccuClient = null;
  }

  private wireCcuEvents(): void {
    if (!this.ccuClient) return;

    this.ccuClient.on('connected', (info) => {
      console.log('[BridgeServer] Camera connected:', info);
      this.broadcast({ type: 'connected', info });
    });

    this.ccuClient.on('stateChanged', (state: CameraState) => {
      this.broadcast({ type: 'state', state });
    });

    this.ccuClient.on('disconnected', () => {
      this.broadcast({ type: 'disconnected' });
    });

    this.ccuClient.on('error', (err: Error) => {
      console.error('[BridgeServer] Camera error:', err);
      this.broadcast({ type: 'error', message: err.message });
    });
  }

  // ─── Camera command dispatcher ────────────────────────────────────────────

  private async dispatchCameraCommand(
    ws: WebSocket,
    cmd: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    if (!this.ccuClient?.connected) {
      this.sendError(ws, 'Not connected to CCU');
      return;
    }

    const num = (key: string, def = 0) => Number(params[key] ?? def);

    switch (cmd) {
      case 'setIris':
        await this.ccuClient.setIris(num('value'));
        break;
      case 'setMasterBlack':
        await this.ccuClient.setMasterBlack(num('value'));
        break;
      case 'setBlackBalance':
        await this.ccuClient.setBlackBalance(num('r'), num('g'), num('b'));
        break;
      case 'setWhiteBalance':
        await this.ccuClient.setWhiteBalance(num('r'), num('g'), num('b'));
        break;
      case 'setMasterGain':
        await this.ccuClient.setMasterGain(num('value'));
        break;
      case 'setMasterGamma':
        await this.ccuClient.setMasterGamma(num('value'));
        break;
      case 'setSaturation':
        await this.ccuClient.setSaturation(num('value'));
        break;
      case 'setDetailLevel':
        await this.ccuClient.setDetailLevel(num('value'));
        break;
      case 'setBars':
        await this.ccuClient.setBars(Boolean(params['on']));
        break;
      case 'setCameraPower':
        await this.ccuClient.setCameraPower(Boolean(params['on']));
        break;
      case 'setNdFilter':
        await this.ccuClient.setNdFilter(num('value'));
        break;
      case 'setShutterSpeed':
        await this.ccuClient.setShutterSpeed(num('value'));
        break;
      default:
        this.sendError(ws, `Unknown command: ${cmd}`);
    }

    // Broadcast updated state
    if (this.ccuClient) {
      this.broadcast({ type: 'state', state: this.ccuClient.state });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private broadcast(msg: unknown): void {
    const data = JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message }));
    }
  }
}
