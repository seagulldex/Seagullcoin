import { spawn } from 'child_process';

function launchNode(port, peers) {
  const env = {
    ...process.env,
    PORT: port,
    PEERS: peers.join(',')
  };
  const node = spawn('node', ['yourNodeEntry.js'], { env });

  node.stdout.on('data', data => console.log(`[Node ${port}] ${data}`));
  node.stderr.on('data', data => console.error(`[Node ${port}] ERROR: ${data}`));

  return node;
}

const nodeCount = 5;
const basePort = 3001;
const nodes = [];

for (let i = 0; i < nodeCount; i++) {
  const port = basePort + i;
  const peers = Array.from({ length: nodeCount }, (_, j) => `ws://localhost:${basePort + j}`).filter(p => p !== `ws://localhost:${port}`);
  nodes.push(launchNode(port, peers));
}
