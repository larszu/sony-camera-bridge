import React, { useState, useCallback, useEffect } from 'react';
import { SonyRcpPanel } from './SonyRcpPanel.tsx';
import { BlackmagicRcpPanel } from './BlackmagicRcpPanel.tsx';
import { CameraConfigPanel } from './CameraConfigPanel.tsx';
import type { CameraConnection, TallyState, CameraState, DashboardState, CameraStatesByNumber } from '../types.ts';

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
function createCamera(cameraNumber: number, type: 'sony' | 'blackmagic' = 'sony'): CameraConnection {
  return {
    id: generateId(),
    name: `${type === 'blackmagic' ? 'BM' : 'Sony'} Camera ${cameraNumber}`,
    cameraNumber,
    protocol: type === 'blackmagic' ? 'blackmagic-rest' : 'sony-700ptp',
    status: 'connected', // Default to connected for demo
    settings: {
      host: type === 'blackmagic' ? 'Pocket-Cinema-Camera-4K.local' : '192.168.1.100',
      port: type === 'blackmagic' ? 80 : 7700,
    },
    state: { ...defaultCameraState },
    tally: { ...defaultTallyState },
  };
}

interface DashboardProps {
  bridgeConnected?: boolean;
  remoteCameraStates?: CameraStatesByNumber;
  onSendCommand?: (cameraId: string, cmd: string, params: Record<string, unknown>) => void;
}

/**
 * Multi-RCP Dashboard
 * Manages multiple camera connections with individual settings
 */
export function Dashboard({ bridgeConnected = false, remoteCameraStates = {}, onSendCommand }: DashboardProps) {
  const [state, setState] = useState<DashboardState>(() => ({
    cameras: [createCamera(1)],
    selectedCameraId: null,
    companionEnabled: true,
    companionPort: 9702,
  }));

  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      cameras: prev.cameras.map((camera) => ({
        ...camera,
        status: bridgeConnected ? 'connected' : camera.status,
        state: {
          ...camera.state,
          ...(remoteCameraStates[camera.cameraNumber] ?? {}),
        },
      })),
    }));
  }, [bridgeConnected, remoteCameraStates]);

  // Add a new Sony camera
  const addSonyCamera = useCallback(() => {
    setState(prev => {
      const nextNumber = prev.cameras.length + 1;
      const newCamera = createCamera(nextNumber, 'sony');
      return {
        ...prev,
        cameras: [...prev.cameras, newCamera],
      };
    });
  }, []);

  // Add a new Blackmagic camera
  const addBlackmagicCamera = useCallback(() => {
    setState(prev => {
      const nextNumber = prev.cameras.length + 1;
      const newCamera = createCamera(nextNumber, 'blackmagic');
      return {
        ...prev,
        cameras: [...prev.cameras, newCamera],
      };
    });
  }, []);

  // Legacy addCamera for compatibility
  const addCamera = addSonyCamera;

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
    const targetCamera = state.cameras.find((camera) => camera.id === cameraId)?.cameraNumber;
    onSendCommand?.(String(targetCamera ?? cameraId), cmd, params);
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

  // Drag and drop handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, cameraId: string) => {
    setDraggedId(cameraId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setState(prev => {
      const cameras = [...prev.cameras];
      const draggedIndex = cameras.findIndex(c => c.id === draggedId);
      const targetIndex = cameras.findIndex(c => c.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      // Swap positions
      const [draggedCamera] = cameras.splice(draggedIndex, 1);
      cameras.splice(targetIndex, 0, draggedCamera);
      
      return { ...prev, cameras };
    });
    
    setDraggedId(null);
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  // Check if camera is Blackmagic type
  const isBlackmagicCamera = (camera: CameraConnection) => 
    camera.protocol === 'blackmagic-rest' || camera.protocol === 'blackmagic-sdi';

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard__header">
        <div className="dashboard__title">
          <span>📹</span>
          <span>Multi-Camera RCP Dashboard</span>
        </div>
        <div className="dashboard__actions">
          <button className="rcp-btn rcp-btn--sony" onClick={addSonyCamera}>
            + Sony Camera
          </button>
          <button className="rcp-btn rcp-btn--blackmagic" onClick={addBlackmagicCamera}>
            + Blackmagic Camera
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
          <button className="add-camera-btn add-camera-btn--sony" onClick={addSonyCamera}>
            <span>+</span>
            <span>Add Sony Camera</span>
          </button>
          <button className="add-camera-btn add-camera-btn--blackmagic" onClick={addBlackmagicCamera}>
            <span>+</span>
            <span>Add Blackmagic Camera</span>
          </button>
        </div>

        {/* Main Area - RCP Panels (Draggable Grid) */}
        <div className="dashboard__main dashboard__main--grid">
          {state.cameras.map(camera => (
            <div 
              key={camera.id} 
              className={`dashboard__rcp-wrapper ${draggedId === camera.id ? 'dashboard__rcp-wrapper--dragging' : ''} ${isBlackmagicCamera(camera) ? 'dashboard__rcp-wrapper--blackmagic' : 'dashboard__rcp-wrapper--sony'}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, camera.id)}
            >
              <div 
                className="dashboard__rcp-drag-handle" 
                title="Drag to reorder"
                draggable
                onDragStart={(e) => handleDragStart(e, camera.id)}
                onDragEnd={handleDragEnd}
              >
                ⋮⋮
              </div>
              {isBlackmagicCamera(camera) ? (
                <BlackmagicRcpPanel
                  state={camera.state}
                  tally={camera.tally}
                  cameraId={camera.cameraNumber}
                  disabled={false}
                  onCommand={(cmd, params) => handleCommand(camera.id, cmd, params)}
                  onSetTally={(tally) => handleSetTally(camera.id, tally)}
                />
              ) : (
                <SonyRcpPanel
                  state={camera.state}
                  tally={camera.tally}
                  cameraId={camera.cameraNumber}
                  disabled={false}
                  onCommand={(cmd, params) => handleCommand(camera.id, cmd, params)}
                  onSetTally={(tally) => handleSetTally(camera.id, tally)}
                />
              )}
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
