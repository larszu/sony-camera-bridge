/**
 * Sony RS-422 8-Pin Serial Transport
 *
 * Physical layer for Sony 9-Pin / RS-422 protocol over serial port.
 * 8-pin DIN pinout:
 *   Pin 1: Ground
 *   Pin 2: Receive A (-)
 *   Pin 3: Transmit B (+)
 *   Pin 4: Transmit Common
 *   Pin 5: Spare
 *   Pin 6: Receive Common
 *   Pin 7: Receive B (+)
 *   Pin 8: Transmit A (-)
 *
 * Protocol: 38400 baud, 8 data bits, odd parity, 1 stop bit
 * Master sends command, slave must respond within 9ms.
 */

import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';

export interface SerialTransportOptions {
  path: string;
  /** Default: 38400 */
  baudRate?: number;
}

export class Rs422Transport extends EventEmitter {
  private port: SerialPort | null = null;
  private rxBuffer: Buffer = Buffer.alloc(0);
  private readonly options: Required<SerialTransportOptions>;

  constructor(options: SerialTransportOptions) {
    super();
    this.options = {
      baudRate: 38400,
      ...options,
    };
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.options.path,
        baudRate: this.options.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'odd',
        autoOpen: false,
      });

      this.port.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port!.on('data', (data: Buffer) => this.onData(data));
        this.port!.on('error', (err) => this.emit('error', err));
        this.port!.on('close', () => this.emit('close'));
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) {
        resolve();
        return;
      }
      this.port.close((err) => (err ? reject(err) : resolve()));
    });
  }

  get isOpen(): boolean {
    return this.port?.isOpen ?? false;
  }

  write(data: Buffer): void {
    if (!this.port?.isOpen) throw new Error('Serial port not open');
    this.port.write(data);
  }

  private onData(data: Buffer): void {
    this.rxBuffer = Buffer.concat([this.rxBuffer, data]);
    this.parseFrames();
  }

  /**
   * Sony 9-Pin frame format:
   *   Byte 0: CMD-1 (upper 4 bits) | DATA COUNT (lower 4 bits)
   *   Byte 1: CMD-2
   *   Byte 2..N: DATA (0..15 bytes)
   *   Last byte: CHECKSUM (lower 8 bits of byte sum)
   */
  private parseFrames(): void {
    while (this.rxBuffer.length >= 2) {
      const dataCount = this.rxBuffer[0] & 0x0f;
      const frameLen = 2 + dataCount + 1; // header + cmd2 + data + checksum

      if (this.rxBuffer.length < frameLen) break;

      const frame = this.rxBuffer.subarray(0, frameLen);
      this.rxBuffer = this.rxBuffer.subarray(frameLen);

      if (this.verifyChecksum(frame)) {
        this.emit('frame', frame);
      } else {
        this.emit('error', new Error(`Checksum mismatch: ${frame.toString('hex')}`));
      }
    }
  }

  private verifyChecksum(frame: Buffer): boolean {
    let sum = 0;
    for (let i = 0; i < frame.length - 1; i++) sum += frame[i];
    return (sum & 0xff) === frame[frame.length - 1];
  }

  static computeChecksum(data: Buffer): number {
    let sum = 0;
    for (const byte of data) sum += byte;
    return sum & 0xff;
  }

  static buildFrame(cmd1: number, cmd2: number, data: Buffer = Buffer.alloc(0)): Buffer {
    const dataCount = data.length & 0x0f;
    const header = ((cmd1 & 0x0f) << 4) | dataCount;
    const body = Buffer.from([header, cmd2, ...data]);
    const checksum = Rs422Transport.computeChecksum(body);
    return Buffer.from([...body, checksum]);
  }

  /** List available serial ports */
  static async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  }
}
