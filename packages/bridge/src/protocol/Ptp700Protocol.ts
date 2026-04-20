/**
 * Sony System 700 Proprietary Protocol (700PTP / SPP)
 *
 * Protocol used by Sony broadcast camera systems (HDC/HSC series).
 * Communication between RCP panels and CCU/cameras via TCP port 7700.
 *
 * Packet structure: [HEADER (1)] [SIZE (1)] [PAYLOAD (SIZE bytes)]
 *
 * Ported from: https://github.com/freehand-dev/SONY.PTP700.SPP (GPL v3)
 * Re-implemented in TypeScript without copying source.
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const enum PacketHeader {
  HandShakeACK = 0x01,
  HandShake = 0x02,
  HandShakeResponse = 0x03,
  Close = 0x04,
  CloseACK = 0x05,
  HeartBeat = 0x08,
  HeartBeatACK = 0x09,
  Notify = 0x0a,
  NotifyACK = 0x0b,
  ErrorId = 0x0c,
  Error = 0x0d,
  Message = 0x0e,
  MessageResponse = 0x0f,
}

export const enum DeviceModel {
  CNA_1 = 0x00,
  MSU_1500 = 0x06,
  RCP_1500 = 0x0a,
  HSCU_100 = 0x10,
  HSCU_300 = 0x0f,
  HSCU_1700 = 0x1a,
}

export const enum SourceId {
  RCP = 0x90,
  HSCU = 0x40,
  MSU = 0x70,
  CHU = 0x20,
}

export const enum CnsMode {
  Legacy = 0x00,
  Bridge = 0x01,
  MCS = 0x02,
}

/** SPP Command Groups (Message50 CMD_GP byte) */
export const enum SppCommandGroup {
  CHU_SWITCH_REL = 0x20,
  CHU_SWITCH_ABS = 0x21,
  CHU_ANALOG_REL = 0x22,
  CHU_ANALOG_ABS = 0x23,
  CHU_AUTO_SETUP_CONTROL = 0x25,
  CHU_SWITCH_WITH_MASK = 0x29,

  CCU_SWITCH_REL = 0x40,
  CCU_SWITCH_ABS = 0x41,
  CCU_ANALOG_REL = 0x42,
  CCU_ANALOG_ABS = 0x43,
  CCU_SWITCH_WITH_MASK = 0x49,
  CCU_FORMAT_CONTROL = 0x4f,

  CNU_SWITCH_ABS = 0x61,
  CNU_ANALOG_ABS = 0x63,
  ADDRESS_SELECTOR = 0x6c,

  RCP_SWITCH_REL = 0x90,
  RCP_SWITCH_ABS = 0x91,
}

/** CHU Analog parameter IDs (PARAM0 of CHU_ANALOG_ABS/REL commands) */
export const ChuAnalogParam = {
  WHITE_R: 0x01,
  WHITE_G: 0x02,
  WHITE_B: 0x03,
  MASTER_FLARE: 0x08,
  FLARE_R: 0x09,
  FLARE_G: 0x0a,
  FLARE_B: 0x0b,
  DETAIL_LIMITER: 0x0c,
  MASTER_BLACK_GAMMA: 0x10,
  MASTER_KNEE_POINT: 0x14,
  MASTER_KNEE_SLOPE: 0x18,
  MASTER_GAMMA: 0x1c,
  GAMMA_R: 0x1d,
  GAMMA_G: 0x1e,
  GAMMA_B: 0x1f,
  MASTER_WHITE_CLIP: 0x20,
  MASTER_BLACK: 0xa9,
  BLACK_R: 0xaa,
  BLACK_G: 0xab,
  BLACK_B: 0xac,
  IRIS: 0x60,
  DETAIL_LEVEL: 0x9b,
  SATURATION: 0xd2,
  WHITE_COLOR_TEMP_CTRL: 0xdc,
  MASTER_WHITE_GAIN: 0xf2,
} as const;

/** CHU Switch parameter IDs (PARAM0 of CHU_SWITCH_ABS/REL commands) */
export const ChuSwitchParam = {
  SHUTTER_SPEED: 0x00,
  MASTER_GAIN: 0x01,
  ND_FILTER: 0x03,
  CC_FILTER: 0x04,
  MASTER_GAMMA_SELECT: 0x06,
  AUTO_IRIS_WINDOW_SELECT: 0x0a,
  STANDARD_GAMMA_TABLE_MODE: 0x13,
  STANDARD_GAMMA_SELECT: 0x14,
  HYPER_GAMMA_SELECT: 0x16,
  DIGITAL_EXTENDER: 0x27,
  SIS_SELECT: 0x20,
} as const;

/** CCU Switch parameter IDs */
export const CcuSwitchParam = {
  GENLOCK_MODE: 0x0a,
  CAM_PW: 0x11,
  BARS_CHARACTER: 0x1a,
  PREVIEW: 0x31,
  MENU_CONTROL: 0x32,
  CHANNEL_ID: 0x83,
} as const;

// ─── Packet Builders ─────────────────────────────────────────────────────────

/** Write big-endian uint16 */
function writeUInt16BE(buf: Buffer, offset: number, value: number): void {
  buf[offset] = (value >> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

/** Read big-endian uint16 */
function readUInt16BE(buf: Buffer, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1];
}

/** Read big-endian uint32 */
function readUInt32BE(buf: Buffer, offset: number): number {
  return (buf[offset] * 0x1000000) + (buf[offset + 1] << 16) + (buf[offset + 2] << 8) + buf[offset + 3];
}

function writeUInt32BE(buf: Buffer, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

/**
 * Build a raw SPP packet: [header][size][...payload]
 */
export function buildPacket(header: PacketHeader, payload: Buffer): Buffer {
  const buf = Buffer.alloc(2 + payload.length);
  buf[0] = header;
  buf[1] = payload.length;
  payload.copy(buf, 2);
  return buf;
}

/**
 * Build HandShake packet sent by RCP client to CCU.
 * Payload layout (18 bytes):
 *   [0..2]  0x02 0x01 0x00  (fixed)
 *   [3]     CNS mode
 *   [4..5]  request ID (big-endian)
 *   [6]     0x01 (fixed)
 *   [7]     device type (SRCID)
 *   [8]     device type1 (SRCID)
 *   [9]     device model
 *   [10..13] serial number (big-endian)
 *   [14..17] 0x64 0x32 0x0a 0x05 (fixed)
 */
export function buildHandshake(
  header: PacketHeader.HandShake | PacketHeader.HandShakeACK,
  mode: CnsMode,
  requestId: number,
  serialNumber: number,
): Buffer {
  const payload = Buffer.alloc(18);
  payload[0] = 0x02;
  payload[1] = 0x01;
  payload[2] = 0x00;
  payload[3] = mode;
  writeUInt16BE(payload, 4, requestId);
  payload[6] = 0x01;
  payload[7] = SourceId.RCP;
  payload[8] = SourceId.RCP;
  payload[9] = DeviceModel.RCP_1500;
  writeUInt32BE(payload, 10, serialNumber);
  payload[14] = 0x64;
  payload[15] = 0x32;
  payload[16] = 0x0a;
  payload[17] = 0x05;
  return buildPacket(header, payload);
}

export function buildHeartBeat(ack = false): Buffer {
  return buildPacket(ack ? PacketHeader.HeartBeatACK : PacketHeader.HeartBeat, Buffer.alloc(0));
}

export function buildNotifyACK(): Buffer {
  return buildPacket(PacketHeader.NotifyACK, Buffer.alloc(0));
}

export function buildClose(): Buffer {
  return buildPacket(PacketHeader.Close, Buffer.alloc(0));
}

export function buildCloseACK(): Buffer {
  return buildPacket(PacketHeader.CloseACK, Buffer.alloc(0));
}

export function buildMessageResponse(responseId: number, innerPacket?: Buffer): Buffer {
  const idBuf = Buffer.alloc(2);
  writeUInt16BE(idBuf, 0, responseId);
  const payload = innerPacket ? Buffer.concat([idBuf, innerPacket]) : idBuf;
  return buildPacket(PacketHeader.MessageResponse, payload);
}

/**
 * Build a Message50 packet (Camera parameter set/request).
 *
 * Payload layout (before command pairs):
 *   [0..1] request ID (big-endian)
 *   [2]    message type 0x50
 *   [3]    0x18 (fixed)
 *   [4]    sub-type: 0x02=Request, 0x01=Response
 *   [5..6] CCU ID (big-endian)
 *   [7]    0x18 (fixed)
 *   [8]    sender SRCID (0x90=RCP)
 *   [9..10] CCU ID repeat (big-endian)
 *   [11..12] command-pairs total size (big-endian)
 *   [13+]  command pairs
 */
export function buildMessage50(
  requestId: number,
  ccuId: number,
  subType: 0x01 | 0x02,
  commands: SppCommandPair[],
): Buffer {
  const cmdBufs = commands.map((c) => c.toBuffer());
  const cmdSize = cmdBufs.reduce((acc, b) => acc + b.length, 0);

  const totalPayload = 13 + cmdSize;
  const payload = Buffer.alloc(totalPayload);
  writeUInt16BE(payload, 0, requestId);
  payload[2] = 0x50;
  payload[3] = 0x18;
  payload[4] = subType;
  writeUInt16BE(payload, 5, ccuId);
  payload[7] = 0x18;
  payload[8] = SourceId.RCP;
  writeUInt16BE(payload, 9, ccuId);
  writeUInt16BE(payload, 11, cmdSize);
  let offset = 13;
  for (const buf of cmdBufs) {
    buf.copy(payload, offset);
    offset += buf.length;
  }
  return buildPacket(PacketHeader.Message, payload);
}

// ─── Command Pair ─────────────────────────────────────────────────────────────

export class SppCommandPair {
  cmdGp: number;
  param0: number;
  param1?: number;
  param2?: number;
  param3?: number;

  constructor(cmdGp: number, param0: number, param1?: number, param2?: number, param3?: number) {
    this.cmdGp = cmdGp;
    this.param0 = param0;
    this.param1 = param1;
    this.param2 = param2;
    this.param3 = param3;
  }

  toBuffer(): Buffer {
    const bytes: number[] = [this.cmdGp, this.param0];
    if (this.param1 !== undefined) bytes.push(this.param1);
    if (this.param2 !== undefined) bytes.push(this.param2);
    if (this.param3 !== undefined) bytes.push(this.param3);
    return Buffer.from(bytes);
  }

  static fromBuffer(buf: Buffer, offset = 0): { pair: SppCommandPair; size: number } {
    const cmdGp = buf[offset];
    // Determine pair size by CMD_GP (matches Message50.SppCommands.ToArray logic)
    let size: number;
    switch (cmdGp) {
      case 0x0b: case 0x22: case 0x23: case 0x27: case 0x29:
      case 0x3c: case 0x3d: case 0x42: case 0x43: case 0x49:
      case 0x6c:
        size = 4; break;
      case 0x40: case 0x41:
        size = buf[offset + 1] === 0x0a ? 4 : 3; break;
      case 0x20: case 0x21: case 0x25:
      case 0x60: case 0x61:
        size = 3; break;
      default:
        size = 2; break;
    }
    const pair = new SppCommandPair(
      cmdGp,
      buf[offset + 1],
      size > 2 ? buf[offset + 2] : undefined,
      size > 3 ? buf[offset + 3] : undefined,
      size > 4 ? buf[offset + 4] : undefined,
    );
    return { pair, size };
  }
}

// ─── Packet Parser ────────────────────────────────────────────────────────────

export interface ParsedPacket {
  header: PacketHeader;
  size: number;
  payload: Buffer;
}

export function parseNextPacket(buf: Buffer): { packet: ParsedPacket; consumed: number } | null {
  if (buf.length < 2) return null;
  const size = buf[1];
  const total = 2 + size;
  if (buf.length < total) return null;
  return {
    packet: {
      header: buf[0] as PacketHeader,
      size,
      payload: buf.subarray(2, total),
    },
    consumed: total,
  };
}

export function getMessageType(packet: ParsedPacket): number {
  if (packet.size < 3) return 0;
  return packet.payload[2];
}

export function getMessageId(packet: ParsedPacket): number {
  if (packet.size < 2) return 0;
  return readUInt16BE(packet.payload, 0);
}

export function parseMessage50Commands(packet: ParsedPacket): SppCommandPair[] {
  if (getMessageType(packet) !== 0x50) return [];
  const cmdSize = readUInt16BE(packet.payload, 11);
  const pairs: SppCommandPair[] = [];
  let offset = 13;
  const end = 13 + cmdSize;
  while (offset < end && offset < packet.payload.length) {
    try {
      const { pair, size } = SppCommandPair.fromBuffer(packet.payload, offset);
      pairs.push(pair);
      offset += size;
    } catch {
      break;
    }
  }
  return pairs;
}

// ─── Handshake Parser ────────────────────────────────────────────────────────

export interface HandshakeInfo {
  mode: CnsMode;
  id: number;
  deviceType: SourceId;
  model: DeviceModel;
  serialNumber: number;
}

export function parseHandshake(packet: ParsedPacket): HandshakeInfo {
  const p = packet.payload;
  return {
    mode: p[3] as CnsMode,
    id: readUInt16BE(p, 4),
    deviceType: p[7] as SourceId,
    model: p[9] as DeviceModel,
    serialNumber: readUInt32BE(p, 10),
  };
}
