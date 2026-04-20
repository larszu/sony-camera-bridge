import { BridgeServer } from './BridgeServer.js';

const PORT = Number(process.env.BRIDGE_PORT ?? 9700);

const server = new BridgeServer(PORT);
server.start();

process.on('SIGINT', () => {
  console.log('\n[Bridge] Shutting down...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});
