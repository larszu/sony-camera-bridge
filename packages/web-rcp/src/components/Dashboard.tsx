import React, { useState, useCallback } from 'react';
import { SonyRcpPanel } from './SonyRcpPanel.tsx';
import { CameraConfigPanel } from './CameraConfigPanel.tsx';
import type { CameraConnection, CameraProtocol, TallyState, CameraState, DashboardState } from '../types.ts';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Default camera state
const defaultCameraState: CameraState = {
  iris: 128,
  masterBlack: 128,
  blackR: 128,
  blackG: 128,
  blackB: 128,
  whiteR: 128,
  whiteG: 128,
  whiteB: 128,
  masterGain: 0,
  masterGamma: 128,
  saturation: 128,
  shutterSpeed: 0,
  bars: false,
  cameraPower: true,
  ndFilter: 0,
  detailLevel: 128,
};

// Default tally state
const defaultTallyState: TallyState = {
  program: false,
  preview: false,
  isoRec: false,
};

// Create a new camera connection
function createCamera(cameraNumber: number): CameraConnection {
  return {
    id: generateId(),
    name: `Camera ${cameraNumber}`,
    cameraNumber,
    protocol: 'sony-700ptp',
    status: 'disconnected',
    settings: {
      host: '192.168.1.100',
      port: 7700,
    },
    state: { ...defaultCameraState },
    tally: { ...defaultTallyState },
  };
}

interface DashboardProps {
  onSendCommand?: (cameraId: string, cmd: string, params: Record<string, unknown>) => void;
}

/**
 * Multi-RCP Dashboard
 * Manages multiple camera connections with individual settings
 */
export function Dashboard({ onSendCommand }: DashboardProps) {
  const [state, setState] = useState<DashboardState>(() => ({
    cameras: [createCamera(1)],
    selectedCameraId: null,
    companionEnabled: true,
    companionPort: 9702,
  }));

  const [showConfig, setShowConfig] = useState<string | null>(null);

  // Add a new camera
  const addCamera = useCallback(() => {
    setState(prev => {
      const nextNumber = prev.cameras.length + 1;
      const newCamera = createCamera(nextNumber);
      return {
        ...prev,
        cameras: [...prev.cameras, newCamera],
      };
    });
  }, []);

  // Remove a camera
  const removeCamera = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      cameras: prev.cameras.filter(c => c.id !== id),
      selectedCameraId: prev.selectedCameraId === id ? null : prev.selectedCameraId,
    }));
  }, []);

  // Update camera settings
  const updateCamera = useCallback((id: string, updates: Partial<CameraConnection>) => {
    setState(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => 
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  }, []);

  // Handle camera command
  const handleCommand = useCallback((cameraId: string, cmd: string, params: Record<string, unknown>) => {
    console.log(`[Camera ${cameraId}] ${cmd}`, params);
    
    // Update local state optimistically
    setState(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => {
        if (c.id !== cameraId) return c;
        
        // Map commands to state updates
        const stateUpdates: Partial<CameraState> = {};
        switch (cmd) {
          case 'setIris':
            stateUpdates.iris = params.value as number;
            break;
          case 'setMasterBlack':
            stateUpdates.masterBlack = params.value as number;
            break;
          case 'setBlackBalance':
            if (params.r !== undefined) stateUpdates.blackR = params.r as number;
            if (params.g !== undefined) stateUpdates.blackG = params.g as number;
            if (params.b !== undefined) stateUpdates.blackB = params.b as number;
            break;
          case 'setWhiteBalance':
            if (params.r !== undefined) stateUpdates.whiteR = params.r as number;
            if (params.g !== undefined) stateUpdates.whiteG = params.g as number;
            if (params.b !== undefined) stateUpdates.whiteB = params.b as number;
            break;
          case 'setMasterGain':
            stateUpdates.masterGain = params.value as number;
            break;
          case 'setNdFilter':
            stateUpdates.ndFilter = params.value as number;
            break;
          case 'setBars':
            stateUpdates.bars = params.on as boolean;
            break;
        }
        
        return {
          ...c,
          state: { ...c.state, ...stateUpdates },
        };
      }),
    }));
    
    // Send to backend
    onSendCommand?.(cameraId, cmd, params);
  }, [onSendCommand]);

  // Handle tally change
  const handleSetTally = useCallback((cameraId: string, tally: Partial<TallyState>) => {
    setState(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => 
        c.id === cameraId 
          ? { ...c, tally: { ...c.tally, ...tally } }
          : c
      ),
    }));
  }, []);

  // Connect/disconnect camera
  const toggleConnection = useCallback((cameraId: string) => {
    setState(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => {
        if (c.id !== cameraId) return c;
        if (c.status === 'connected') {
          return { ...c, status: 'disconnected' };
        } else {
          return { ...c, status: 'connecting' };
        }
      }),
    }));
    
    // Simulate connection
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        cameras: prev.cameras.map(c => 
          c.id === cameraId && c.status === 'connecting'
            ? { ...c, status: 'connected' }
            : c
        ),
      }));
    }, 1000);
  }, []);

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard__header">
        <div className="dashboard__title">
          <span>📹</span>
          <span>Camera Control Dashboard</span>
        </div>
        <div className="dashboard__actions">
          <button className="rcp-btn" onClick={addCamera}>
            + Add Camera
          </button>
        </div>
      </div>

      <div className="dashboard__body">
        {/* Sidebar - Camera List */}
        <div className="dashboard__sidebar">
          <div className="dashboard__sidebar-header">
            Cameras ({state.cameras.length})
          </div>
          <div className="dashboard__camera-list">
            {state.cameras.map(camera => (
              <div
                key={camera.id}
                className={`camera-card ${
                  state.selectedCameraId === camera.id ? 'camera-card--selected' : ''
                } ${
                  camera.status === 'connected' ? 'camera-card--connected' : ''
                } ${
                  camera.status === 'error' ? 'camera-card--error' : ''
                }`}
                onClick={() => setState(prev => ({ ...prev, selectedCameraId: camera.id }))}
              >
                <div className="camera-card__icon">
                  {camera.cameraNumber}
                </div>
                <div className="camera-card__info">
                  <div className="camera-card__name">{camera.name}</div>
                  <div className={`camera-card__status camera-card__status--${camera.status}`}>
                    {camera.status === 'connected' && '● Connected'}
                    {camera.status === 'connecting' && '○ Connecting...'}
                    {camera.status === 'disconnected' && '○ Disconnected'}
                    {camera.status === 'error' && `● ${camera.error || 'Error'}`}
                  </div>
                </div>
                <button 
                  className="rcp-btn rcp-btn--sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfig(camera.id);
                  }}
                >
                  ⚙
                </button>
              </div>
            ))}
          </div>
          <button className="add-camera-btn" onClick={addCamera}>
            <span>+</span>
            <span>Add Camera</span>
          </button>
        </div>

        {/* Main Area - RCP Panels */}
        <div className="dashboard__main">
          {state.cameras.map(camera => (
            <div key={camera.id} className="dashboard__rcp-wrapper">
              <SonyRcpPanel
                state={camera.state}
                tally={camera.tally}
                cameraId={camera.cameraNumber}
                disabled={camera.status !== 'connected'}
                onCommand={(cmd, params) => handleCommand(camera.id, cmd, params)}
                onSetTally={(tally) => handleSetTally(camera.id, tally)}
              />
              <div className="dashboard__rcp-footer">
                <span className="dashboard__rcp-name">{camera.name}</span>
                <button
                  className={`rcp-btn rcp-btn--sm ${camera.status === 'connected' ? 'rcp-btn--green' : ''}`}
                  onClick={() => toggleConnection(camera.id)}
                >
                  {camera.status === 'connected' ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Camera Config Modal */}
      {showConfig && (
        <CameraConfigPanel
          camera={state.cameras.find(c => c.id === showConfig)!}
          onUpdate={(updates) => updateCamera(showConfig, updates)}
          onDelete={() => {
            removeCamera(showConfig);
            setShowConfig(null);
          }}
          onClose={() => setShowConfig(null)}
        />
      )}
    </div>
  );
}
