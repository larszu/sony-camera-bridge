import React, { useState } from 'react';
import type { CameraConnection, CameraProtocol } from '../types.ts';

interface CameraConfigPanelProps {
  camera: CameraConnection;
  onUpdate: (updates: Partial<CameraConnection>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PROTOCOLS: { value: CameraProtocol; label: string; description: string }[] = [
  { 
    value: 'sony-700ptp', 
    label: 'Sony 700PTP (TCP)', 
    description: 'Sony 700 Protocol over TCP/IP - BRC, BVP cameras' 
  },
  { 
    value: 'sony-700spp', 
    label: 'Sony 700SPP (RS-422)', 
    description: 'Sony 700 Protocol over RS-422 serial' 
  },
  { 
    value: 'sony-crsdk', 
    label: 'Sony Camera Remote SDK', 
    description: 'USB/WiFi control for FX3, FX6, A7 series, ZV-E1' 
  },
  { 
    value: 'sony-mnc', 
    label: 'Sony Monitor & Control', 
    description: 'WiFi protocol for supported cameras' 
  },
  { 
    value: 'blackmagic-sdi', 
    label: 'Blackmagic SDI Control', 
    description: 'Blackmagic camera control over SDI' 
  },
  { 
    value: 'manual', 
    label: 'Manual / Demo', 
    description: 'No camera connection - for testing' 
  },
];

/**
 * Camera connection configuration panel
 */
export function CameraConfigPanel({ camera, onUpdate, onDelete, onClose }: CameraConfigPanelProps) {
  const [localState, setLocalState] = useState({
    name: camera.name,
    cameraNumber: camera.cameraNumber,
    protocol: camera.protocol,
    settings: { ...camera.settings },
  });

  const handleSave = () => {
    onUpdate({
      name: localState.name,
      cameraNumber: localState.cameraNumber,
      protocol: localState.protocol,
      settings: localState.settings,
    });
    onClose();
  };

  const updateSettings = (key: string, value: unknown) => {
    setLocalState(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  return (
    <div className="config-modal-overlay" onClick={onClose}>
      <div className="camera-config" onClick={e => e.stopPropagation()}>
        <div className="camera-config__header">
          <h3 className="camera-config__title">Camera Configuration</h3>
          <button className="rcp-btn rcp-btn--sm" onClick={onClose}>✕</button>
        </div>

        {/* Basic Settings */}
        <div className="camera-config__section">
          <div className="camera-config__section-title">General</div>
          
          <div className="camera-config__row">
            <div className="camera-config__field">
              <label className="camera-config__label">Name</label>
              <input
                type="text"
                className="camera-config__input"
                value={localState.name}
                onChange={e => setLocalState(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="camera-config__field">
              <label className="camera-config__label">Camera #</label>
              <input
                type="number"
                className="camera-config__input"
                value={localState.cameraNumber}
                min={1}
                max={99}
                onChange={e => setLocalState(prev => ({ ...prev, cameraNumber: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
        </div>

        {/* Protocol Selection */}
        <div className="camera-config__section">
          <div className="camera-config__section-title">Protocol</div>
          
          <div className="camera-config__protocol-list">
            {PROTOCOLS.map(proto => (
              <label 
                key={proto.value}
                className={`camera-config__protocol ${localState.protocol === proto.value ? 'camera-config__protocol--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="protocol"
                  value={proto.value}
                  checked={localState.protocol === proto.value}
                  onChange={() => setLocalState(prev => ({ ...prev, protocol: proto.value }))}
                />
                <div className="camera-config__protocol-info">
                  <span className="camera-config__protocol-label">{proto.label}</span>
                  <span className="camera-config__protocol-desc">{proto.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Connection Settings based on protocol */}
        <div className="camera-config__section">
          <div className="camera-config__section-title">Connection</div>
          
          {/* TCP Settings */}
          {(localState.protocol === 'sony-700ptp' || localState.protocol === 'sony-mnc') && (
            <div className="camera-config__row">
              <div className="camera-config__field" style={{ flex: 2 }}>
                <label className="camera-config__label">IP Address</label>
                <input
                  type="text"
                  className="camera-config__input"
                  value={localState.settings.host || ''}
                  placeholder="192.168.1.100"
                  onChange={e => updateSettings('host', e.target.value)}
                />
              </div>
              <div className="camera-config__field">
                <label className="camera-config__label">Port</label>
                <input
                  type="number"
                  className="camera-config__input"
                  value={localState.settings.port || 7700}
                  onChange={e => updateSettings('port', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Serial Settings */}
          {localState.protocol === 'sony-700spp' && (
            <>
              <div className="camera-config__field">
                <label className="camera-config__label">Serial Port</label>
                <input
                  type="text"
                  className="camera-config__input"
                  value={localState.settings.serialPath || ''}
                  placeholder="COM3 or /dev/ttyUSB0"
                  onChange={e => updateSettings('serialPath', e.target.value)}
                />
              </div>
              <div className="camera-config__row">
                <div className="camera-config__field">
                  <label className="camera-config__label">Baud Rate</label>
                  <select
                    className="camera-config__select"
                    value={localState.settings.baudRate || 38400}
                    onChange={e => updateSettings('baudRate', parseInt(e.target.value))}
                  >
                    <option value={9600}>9600</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={57600}>57600</option>
                    <option value={115200}>115200</option>
                  </select>
                </div>
                <div className="camera-config__field">
                  <label className="camera-config__label">Parity</label>
                  <select
                    className="camera-config__select"
                    value={localState.settings.parity || 'odd'}
                    onChange={e => updateSettings('parity', e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="odd">Odd</option>
                    <option value="even">Even</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* USB Settings */}
          {localState.protocol === 'sony-crsdk' && (
            <>
              <div className="camera-config__field">
                <label className="camera-config__label">USB Device</label>
                <select
                  className="camera-config__select"
                  value={localState.settings.usbDeviceId || ''}
                  onChange={e => updateSettings('usbDeviceId', e.target.value)}
                >
                  <option value="">-- Scan for devices --</option>
                  <option value="demo">Demo: Sony FX3</option>
                </select>
                <button className="rcp-btn rcp-btn--sm" style={{ marginTop: 4 }}>
                  🔍 Scan USB
                </button>
              </div>
              <div className="camera-config__note">
                Sony Camera Remote SDK unterstützt:<br/>
                FX3, FX6, FX9, A7 IV, A7S III, A7R V, ZV-E1, A1
              </div>
            </>
          )}

          {/* WIZ108SR Bridge */}
          {(localState.protocol === 'sony-700ptp' || localState.protocol === 'sony-700spp') && (
            <div className="camera-config__field">
              <label className="camera-config__label">WIZ108SR Bridge (optional)</label>
              <select
                className="camera-config__select"
                value={localState.settings.wiznetMac || ''}
                onChange={e => updateSettings('wiznetMac', e.target.value)}
              >
                <option value="">Direct connection</option>
                <option value="demo">00:08:DC:XX:XX:XX (Demo)</option>
              </select>
            </div>
          )}

          {/* Demo mode */}
          {localState.protocol === 'manual' && (
            <div className="camera-config__note">
              Manual mode - no actual camera connection.<br/>
              Use for testing or demonstration.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="camera-config__actions">
          <button className="rcp-btn rcp-btn--red" onClick={onDelete}>
            Delete Camera
          </button>
          <div style={{ flex: 1 }} />
          <button className="rcp-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="rcp-btn rcp-btn--green" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
