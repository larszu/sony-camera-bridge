import React, { useState, useEffect } from 'react';
import type { BridgeConfig } from '../types.ts';

interface Props {
  config: BridgeConfig;
  ports: string[];
  onSetConfig: (cfg: Partial<BridgeConfig>) => void;
  onListPorts: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  cameraConnected: boolean;
  wsStatus: string;
}

export function ConnectionPanel({ config, ports, onSetConfig, onListPorts, onConnect, onDisconnect, cameraConnected, wsStatus }: Props) {
  const [mode, setMode] = useState<'tcp' | 'serial'>(config.connectionMode ?? 'tcp');
  const [host, setHost] = useState(config.tcpHost ?? '192.168.1.10');
  const [port, setPort] = useState(String(config.tcpPort ?? 7700));
  const [serialPath, setSerialPath] = useState(config.serialPath ?? '');
  const [baudRate, setBaudRate] = useState(String(config.baudRate ?? 38400));
  const [ccuId, setCcuId] = useState(String(config.ccuId ?? 0));

  // Fetch serial ports when switching to serial mode
  useEffect(() => {
    if (mode === 'serial') onListPorts();
  }, [mode, onListPorts]);

  // Sync when config changes from server
  useEffect(() => {
    if (config.connectionMode) setMode(config.connectionMode);
    if (config.tcpHost) setHost(config.tcpHost);
    if (config.tcpPort) setPort(String(config.tcpPort));
    if (config.serialPath) setSerialPath(config.serialPath);
    if (config.baudRate) setBaudRate(String(config.baudRate));
    if (config.ccuId !== undefined) setCcuId(String(config.ccuId));
  }, [config]);

  const applyAndConnect = () => {
    const cfg: Partial<BridgeConfig> = {
      connectionMode: mode,
      ccuId: Number(ccuId),
    };
    if (mode === 'tcp') {
      cfg.tcpHost = host;
      cfg.tcpPort = Number(port);
    } else {
      cfg.serialPath = serialPath;
      cfg.baudRate = Number(baudRate);
    }
    onSetConfig(cfg);
    setTimeout(onConnect, 100);
  };

  return (
    <div className="panel panel--connection">
      <h2 className="panel__title">Connection</h2>

      {/* Mode selector */}
      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === 'tcp' ? 'mode-tab--active' : ''}`}
          onClick={() => setMode('tcp')}
        >
          TCP / Netzwerk
        </button>
        <button
          className={`mode-tab ${mode === 'serial' ? 'mode-tab--active' : ''}`}
          onClick={() => setMode('serial')}
        >
          8-Pin RS-422 Seriell
        </button>
      </div>

      {mode === 'tcp' ? (
        <div className="connection-row">
          <div className="field">
            <label>CCU / RP700 IP</label>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.10" />
          </div>
          <div className="field field--sm">
            <label>Port</label>
            <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="7700" type="number" />
          </div>
          <div className="field field--sm">
            <label>CCU ID</label>
            <input value={ccuId} onChange={(e) => setCcuId(e.target.value)} placeholder="0" type="number" />
          </div>
        </div>
      ) : (
        <div className="connection-row">
          <div className="field">
            <label>Serial Port</label>
            <div className="serial-port-row">
              <select
                value={serialPath}
                onChange={(e) => setSerialPath(e.target.value)}
                className="select-group__select"
              >
                <option value="">— Port wählen —</option>
                {ports.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button className="btn btn--sm" onClick={onListPorts} title="Ports neu laden">⟳</button>
            </div>
          </div>
          <div className="field field--sm">
            <label>Baud Rate</label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              className="select-group__select"
            >
              <option value="38400">38400</option>
              <option value="19200">19200</option>
              <option value="9600">9600</option>
            </select>
          </div>
          <div className="field field--sm">
            <label>CCU ID</label>
            <input value={ccuId} onChange={(e) => setCcuId(e.target.value)} placeholder="0" type="number" />
          </div>
        </div>
      )}

      <div className="connection-actions">
        {cameraConnected ? (
          <button className="btn btn--danger" onClick={onDisconnect}>Disconnect</button>
        ) : (
          <button className="btn btn--primary" onClick={applyAndConnect}>Connect</button>
        )}
      </div>

      <div className="status-row">
        <span className={`status-dot status-dot--${wsStatus === 'connected' ? 'ok' : 'err'}`} />
        <span>Bridge: {wsStatus}</span>
        <span className={`status-dot status-dot--${cameraConnected ? 'ok' : 'err'} ml-16`} />
        <span>Kamera: {cameraConnected ? 'Verbunden' : 'Offline'}</span>
        {mode === 'serial' && serialPath && (
          <span className="ml-16" style={{ color: 'var(--text-muted)' }}>({serialPath})</span>
        )}
      </div>
    </div>
  );
}
