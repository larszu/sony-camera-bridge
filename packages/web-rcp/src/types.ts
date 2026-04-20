export interface CameraState {
  iris?: number;
  masterBlack?: number;
  blackR?: number;
  blackG?: number;
  blackB?: number;
  whiteR?: number;
  whiteG?: number;
  whiteB?: number;
  masterGain?: number;
  masterGamma?: number;
  saturation?: number;
  shutterSpeed?: number;
  bars?: boolean;
  cameraPower?: boolean;
  ndFilter?: number;
  masterWhiteClip?: number;
  detailLevel?: number;
}

export interface BridgeConfig {
  connectionMode?: 'tcp' | 'serial';
  tcpHost?: string;
  tcpPort?: number;
  serialPath?: string;
  baudRate?: number;
  ccuId?: number;
}

export interface WiznetDevice {
  ident: string;
  fw: string;
  mac: string;
  ip: string;
  port: number;
  mode: 'server' | 'client';
  baud: number;
  parity: 'odd' | 'even' | 'none';
  lastSeen: number;
}
