import { spawn } from 'child_process';

const NODE_ENTRY = 'yourNodeEntry.js'; // change to your node main file
const NODE_COUNT = 5;
const BASE_PORT = 3001;
const MESSAGE_DROP_RATE = 0.1; // 10% messages dropped
const MAX_DELAY_MS = 200;

const nodes = [];

// Launch all nodes
for (let i = 0; i < NODE_COUNT; i++) {
  const port = BASE_PORT + i;
  const peers = Array.from({ length: NODE_COUNT }, (_, j) => `ws://localhost:${BASE_PORT + j}`)
    .filter(p => p !== `ws://localhost:${port}`);

  nodes.push(launchNode(port, peers));
}

function launchNode(port, peers) {
  const env = {
    ...process.env,
    PORT: port,
    PEERS: peers.join(',')
  };
  const node = spawn('node', [NODE_ENTRY], { env });

  node.stdout.on('data', data => {
    process.stdout.write(`[Node ${port}] ${data}`);
  });
  node.stderr.on('data', data => {
    process.stderr.write(`[Node ${port}] ERROR: ${data}`);
  });
  node.on('exit', (code, signal) => {
    console.log(`[Node ${port}] exited with code ${code} signal ${signal}`);
  });

  return node;
}

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log('\nShutting down testnet...');
  nodes.forEach(node => node.kill('SIGINT'));
  setTimeout(() => process.exit(0), 1000);
});
