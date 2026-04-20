/**
 * WIZnet WIZ108SR Discovery & Configuration
 *
 * Discovers devices running our custom Sony Bridge firmware on the local
 * network via UDP broadcast on port 5000.
 *
 * Protocol:
 *   → Broadcast "SBRG_DISCOVER\0" to 255.255.255.255:5000
 *   ← Each device responds with JSON: { ident, fw, mac, ip, port, mode, baud, parity }
 *
 *   → Unicast "SBRG_CONFIG\0" + JSON to device_ip:5000
 *   ← Device responds "SBRG_CONFIG_OK\0" and reboots with new config
 */

import dgram from 'dgram';
import { EventEmitter } from 'events';

export interface WiznetDevice {
  ident: string;
  fw: string;
  mac: string;
  ip: string;
  port: number;
  mode: 'server' | 'client';
  baud: number;
  parity: 'odd' | 'even' | 'none';
  /** Timestamp of last discovery response */
  lastSeen: number;
}

export interface WiznetDeviceConfig {
  ip?: string;
  subnet?: string;
  gateway?: string;
  port?: number;
  mode?: 'server' | 'client';
  peer_ip?: string;
  peer_port?: number;
  baud?: number;
  parity?: 'odd' | 'even' | 'none';
  dhcp?: boolean;
}

const DISCOVER_PORT = 5000;
const DISCOVER_MSG = 'SBRG_DISCOVER\0';
const CONFIG_MSG = 'SBRG_CONFIG\0';
const DISCOVER_TIMEOUT = 2000;

export class WiznetDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private devices = new Map<string, WiznetDevice>();

  /**
   * Scan the local network for Sony Bridge WIZ108SR devices.
   * Returns discovered devices after the timeout period.
   */
  async discover(timeoutMs = DISCOVER_TIMEOUT): Promise<WiznetDevice[]> {
    this.devices.clear();

    return new Promise((resolve) => {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      sock.on('message', (msg, rinfo) => {
        try {
          const text = msg.toString('utf-8');
          const device: WiznetDevice = {
            ...JSON.parse(text),
            lastSeen: Date.now(),
          };
          // Use MAC as unique key
          this.devices.set(device.mac, device);
          this.emit('device', device);
        } catch {
          // Not our device or malformed response
        }
      });

      sock.bind(() => {
        sock.setBroadcast(true);
        const buf = Buffer.from(DISCOVER_MSG, 'utf-8');
        sock.send(buf, 0, buf.length, DISCOVER_PORT, '255.255.255.255');
      });

      setTimeout(() => {
        sock.close();
        resolve(Array.from(this.devices.values()));
      }, timeoutMs);
    });
  }

  /**
   * Send configuration to a specific WIZ108SR device.
   * The device will save to flash and reboot with new settings.
   */
  async configure(
    deviceIp: string,
    config: WiznetDeviceConfig,
    timeoutMs = 3000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = dgram.createSocket('udp4');
      let resolved = false;

      sock.on('message', (msg) => {
        const text = msg.toString('utf-8');
        if (text.startsWith('SBRG_CONFIG_OK')) {
          resolved = true;
          sock.close();
          resolve(true);
        }
      });

      const json = JSON.stringify(config);
      const payload = Buffer.from(CONFIG_MSG + json, 'utf-8');

      sock.send(payload, 0, payload.length, DISCOVER_PORT, deviceIp, (err) => {
        if (err) {
          sock.close();
          resolve(false);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          sock.close();
          resolve(false);
        }
      }, timeoutMs);
    });
  }
}
