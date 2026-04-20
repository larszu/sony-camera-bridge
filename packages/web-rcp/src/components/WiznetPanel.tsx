import React from 'react';
import type { WiznetDevice, BridgeConfig } from '../types.ts';

interface Props {
  devices: WiznetDevice[];
  onDiscover: () => void;
  onConfigure: (deviceIp: string, config: Record<string, unknown>) => void;
  onSelectDevice: (device: WiznetDevice) => void;
}

export function WiznetPanel({ devices, onDiscover, onConfigure, onSelectDevice }: Props) {
  return (
    <div className="panel panel--wiznet">
      <div className="panel__header">
        <h2 className="panel__title">WIZ108SR Devices</h2>
        <button className="btn btn--sm" onClick={onDiscover} title="Netzwerk scannen">
          Scan
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="wiznet-empty">
          Keine Geräte gefunden. Klicke <strong>Scan</strong> um das Netzwerk zu durchsuchen.
        </div>
      ) : (
        <div className="wiznet-list">
          {devices.map((d) => (
            <div key={d.mac} className="wiznet-card">
              <div className="wiznet-card__header">
                <span className="wiznet-card__ident">{d.ident}</span>
                <span className="wiznet-card__fw">v{d.fw}</span>
              </div>
              <div className="wiznet-card__info">
                <span><strong>IP:</strong> {d.ip}:{d.port}</span>
                <span><strong>MAC:</strong> {d.mac}</span>
                <span><strong>Modus:</strong> {d.mode === 'server' ? 'Kamera (Server)' : 'RCP (Client)'}</span>
                <span><strong>Seriell:</strong> {d.baud} Baud, Parity: {d.parity}</span>
              </div>
              <div className="wiznet-card__actions">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => onSelectDevice(d)}
                  title="Dieses Gerät als TCP-Ziel verwenden"
                >
                  Verbinden
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
