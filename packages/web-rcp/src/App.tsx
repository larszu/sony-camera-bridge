import React, { useCallback } from 'react';
import { useBridge } from './hooks/useBridge.ts';
import { ConnectionPanel } from './components/ConnectionPanel.tsx';
import { RcpDashboard } from './components/RcpDashboard.tsx';

export default function App() {
  const {
    status,
    cameraConnected,
    state,
    config,
    ports,
    errorMsg,
    send,
    connectCamera,
    disconnectCamera,
    listPorts,
    setConfig,
  } = useBridge();

  const handleCommand = useCallback(
    (cmd: string, params: Record<string, unknown>) => {
      send('command', { cmd, params });
    },
    [send],
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

        <RcpDashboard
          state={state}
          disabled={!cameraConnected}
          onCommand={handleCommand}
        />
      </main>
    </div>
  );
}
