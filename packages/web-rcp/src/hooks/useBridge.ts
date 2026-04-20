/**
 * WebSocket hook for Sony Camera Bridge
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { CameraState, BridgeConfig } from '../types.ts';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

interface UseBridgeReturn {
  status: ConnectionStatus;
  cameraConnected: boolean;
  state: CameraState;
  config: BridgeConfig;
  ports: string[];
  errorMsg: string | null;
  send: (type: string, payload?: Record<string, unknown>) => void;
  connectCamera: () => void;
  disconnectCamera: () => void;
  listPorts: () => void;
  setConfig: (config: Partial<BridgeConfig>) => void;
}

const WS_URL = `ws://${window.location.hostname}:9700`;

export function useBridge(): UseBridgeReturn {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [cameraConnected, setCameraConnected] = useState(false);
  const [state, setState] = useState<CameraState>({});
  const [config, setConfigState] = useState<BridgeConfig>({ connectionMode: 'tcp', tcpHost: '192.168.1.10', tcpPort: 7700, serialPath: '', baudRate: 38400, ccuId: 0 });
  const [ports, setPorts] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    setStatus('connecting');
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      setStatus('connected');
      setErrorMsg(null);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'state':
            setState((prev) => ({ ...prev, ...msg.state }));
            break;
          case 'connected':
            setCameraConnected(true);
            break;
          case 'disconnected':
            setCameraConnected(false);
            setState({});
            break;
          case 'error':
            setErrorMsg(msg.message as string);
            break;
          case 'ports':
            setPorts(msg.ports as string[]);
            break;
          case 'config':
            setConfigState(msg.config as BridgeConfig);
            break;
        }
      } catch { /* ignore malformed */ }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      setCameraConnected(false);
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      setStatus('error');
      setErrorMsg('WebSocket connection failed');
    };

    ws.current = socket;
  }, []);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const connectCamera = useCallback(() => send('connect'), [send]);
  const disconnectCamera = useCallback(() => send('disconnect'), [send]);
  const listPorts = useCallback(() => send('listPorts'), [send]);

  const setConfig = useCallback((cfg: Partial<BridgeConfig>) => {
    send('setConfig', { config: cfg });
  }, [send]);

  return { status, cameraConnected, state, config, ports, errorMsg, send, connectCamera, disconnectCamera, listPorts, setConfig };
}
