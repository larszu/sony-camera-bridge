/**
 * Sony 9-Pin / RS-422 Protocol Command Types
 *
 * CMD-1 upper nibble encodes direction:
 *   0x0: System Control (Master→Slave)
 *   0x1: Return for 0, 2, or 4 (Slave→Master)
 *   0x2: Transport Control (Master→Slave)
 *   0x4: Preset/Select Control (Master→Slave)
 *   0x6: Sense Request (Master→Slave)
 *   0x7: Sense Return (Slave→Master)
 */

export const CMD1 = {
  SYSTEM_CONTROL: 0x0,
  RETURN: 0x1,
  TRANSPORT_CONTROL: 0x2,
  PRESET_SELECT: 0x4,
  SENSE_REQUEST: 0x6,
  SENSE_RETURN: 0x7,
} as const;

/** System Control commands (CMD-1 = 0x0) */
export const SYSTEM_CMD = {
  LOCAL_DISABLE: 0x0c,
  LOCAL_ENABLE: 0x1c,
  DEVICE_TYPE_REQUEST: 0x11,
} as const;

/** Transport Control commands (CMD-1 = 0x2) */
export const TRANSPORT_CMD = {
  STOP: 0x00,
  PLAY: 0x01,
  RECORD: 0x02,
  STANDBY_OFF: 0x04,
  STANDBY_ON: 0x20,
  FAST_FORWARD: 0x10,
  REWIND: 0x20,
  EJECT: 0x40,
  CUE: 0x31,
} as const;

/** Sense Request commands (CMD-1 = 0x6) */
export const SENSE_REQUEST_CMD = {
  TC_GEN_SENSE: 0x06,
  CURRENT_TIME_SENSE: 0x0c,
  IN_DATA_SENSE: 0x10,
  OUT_DATA_SENSE: 0x11,
  AUDIO_SENSE: 0x42,
  STATUS_SENSE: 0x20,
  DEVICE_TYPE: 0x11,
} as const;

/** ACK/NAK response bytes */
export const RESPONSE = {
  ACK: 0x01,
  NAK: 0x12,
} as const;

export type SonyFrame = {
  cmd1: number;
  cmd2: number;
  data: Buffer;
  raw: Buffer;
};

export function parseFrame(raw: Buffer): SonyFrame {
  const cmd1 = (raw[0] >> 4) & 0x0f;
  const dataCount = raw[0] & 0x0f;
  const cmd2 = raw[1];
  const data = raw.subarray(2, 2 + dataCount);
  return { cmd1, cmd2, data, raw };
}
