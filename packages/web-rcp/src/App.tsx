import React, { useCallback } from 'react';
import { useBridge } from './hooks/useBridge.ts';
import { ConnectionPanel } from './components/ConnectionPanel.tsx';
import { SonyRcpPanel } from './components/SonyRcpPanel.tsx';
import { WiznetPanel } from './components/WiznetPanel.tsx';
import type { WiznetDevice } from './types.ts';
import type { TallyState } from './components/TallyBar.tsx';
import './styles/sony-rcp.css';

export default function App() {
  const {
    status,
    cameraConnected,
    state,
    config,
    ports,
    wiznetDevices,
    tally,
    errorMsg,
    send,
    connectCamera,
    disconnectCamera,
    listPorts,
    setConfig,
    discoverWiznet,
    configureWiznet,
    setTally,
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

  const handleSetTally = useCallback(
    (t: Partial<TallyState>) => {
      setTally(t);
    },
    [setTally],
  );

  return (
    <div className="app">
      <main className="app__main app__main--rcp">
        <aside className="app__sidebar">
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

          {errorMsg && <div className="app__error-panel">{errorMsg}</div>}
        </aside>

        <div className="app__rcp">
          <SonyRcpPanel
            state={state}
            tally={tally}
            disabled={!cameraConnected}
            onCommand={handleCommand}
            onSetTally={handleSetTally}
          />
        </div>
      </main>
    </div>
  );
}
