import React, { useCallback } from 'react';
import { useBridge } from './hooks/useBridge.ts';
import { ConnectionPanel } from './components/ConnectionPanel.tsx';
import { RcpDashboard } from './components/RcpDashboard.tsx';
import { WiznetPanel } from './components/WiznetPanel.tsx';
import type { WiznetDevice } from './types.ts';

export default function App() {
  const {
    status,
    cameraConnected,
    state,
    config,
    ports,
    wiznetDevices,
    errorMsg,
    send,
    connectCamera,
    disconnectCamera,
    listPorts,
    setConfig,
    discoverWiznet,
    configureWiznet,
  } = useBridge();

  const handleCommand = useCallback(
    (cmd: string, params: Record<string, unknown>) => {
      send('command', { cmd, params });
    },
    [send],
  );

  const handleSelectWiznet = useCallback(
    (device: WiznetDevice) => {
      // Auto-fill TCP connection with selected WIZ108SR device
      setConfig({
        connectionMode: 'tcp',
        tcpHost: device.ip,
        tcpPort: device.port,
      });
    },
    [setConfig],
  );

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__logo">🎥 Sony Camera RCP</span>
        {errorMsg && <span className="app__error">{errorMsg}</span>}
      </header>

      <main className="app__main">
        <ConnectionPanel
          config={config}
          ports={ports}
          onSetConfig={setConfig}
          onListPorts={listPorts}
          onConnect={connectCamera}
          onDisconnect={disconnectCamera}
          cameraConnected={cameraConnected}
          wsStatus={status}
        />

        <WiznetPanel
          devices={wiznetDevices}
          onDiscover={discoverWiznet}
          onConfigure={configureWiznet}
          onSelectDevice={handleSelectWiznet}
        />

        <RcpDashboard
          state={state}
          disabled={!cameraConnected}
          onCommand={handleCommand}
        />
      </main>
    </div>
  );
}
