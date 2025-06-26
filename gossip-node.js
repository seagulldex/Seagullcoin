const WebSocket = require('ws');
const PORT = process.env.PORT || 3001;
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];

let blockchain = [];
let transactionPool = [];

const server = new WebSocket.Server({ port: PORT });

const sockets = [];

console.log(`🌐 Node started on ws://localhost:${PORT}`);

// Handle incoming connections
server.on('connection', socket => {
  console.log('✅ New peer connected');
  sockets.push(socket);

  socket.on('message', message => {
    const data = JSON.parse(message);
    handleMessage(data, socket);
  });

  socket.on('close', () => {
    console.log('❌ Peer disconnected');
    sockets.splice(sockets.indexOf(socket), 1);
  });
});

// Connect to peers
function connectToPeer(address) {
  const socket = new WebSocket(address);

  socket.on('open', () => {
    console.log(`🔌 Connected to peer: ${address}`);
    sockets.push(socket);
  });

  socket.on('message', message => {
    const data = JSON.parse(message);
    handleMessage(data, socket);
  });

  socket.on('close', () => {
    console.log(`❌ Lost connection to peer: ${address}`);
    sockets.splice(sockets.indexOf(socket), 1);
  });

  socket.on('error', err => {
    console.error(`⚠️ Connection failed to ${address}:`, err.message);
  });
}

// Handle incoming messages
function handleMessage(data, socket) {
  switch (data.type) {
    case 'BLOCK':
      console.log('📦 Received new block');
      handleReceivedBlock(data.block);
      broadcast({ type: 'BLOCK', block: data.block }, socket);
      break;
    case 'TX':
      console.log('💸 Received new transaction');
      transactionPool.push(data.tx);
      broadcast({ type: 'TX', tx: data.tx }, socket);
      break;
    default:
      console.log('❓ Unknown message type:', data.type);
  }
}

// Add to chain if valid (simplified)
function handleReceivedBlock(block) {
  if (!blockchain.length || block.previousHash === getLatestHash()) {
    blockchain.push(block);
    console.log('✅ Block added to chain');
  } else {
    console.warn('⚠️ Rejected block: invalid previous hash');
  }
}

function getLatestHash() {
  return blockchain[blockchain.length - 1]?.hash || '0';
}

// Broadcast to all peers except sender
function broadcast(message, exclude) {
  sockets.forEach(s => {
    if (s !== exclude && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(message));
    }
  });
}

// Bootstrap connections
peers.forEach(connectToPeer);

// Simulate block creation
setInterval(() => {
  if (transactionPool.length === 0) return;

  const block = {
    index: blockchain.length,
    timestamp: Date.now(),
    transactions: transactionPool,
    previousHash: getLatestHash(),
    hash: (Math.random() + '').slice(2), // fake hash for demo
  };

  blockchain.push(block);
  transactionPool = [];

  console.log('🚀 Created new block and broadcasting...');
  broadcast({ type: 'BLOCK', block });
}, 15000);

// Example: add a transaction
setInterval(() => {
  const tx = {
    from: `Node-${PORT}`,
    to: `Wallet-${Math.floor(Math.random() * 1000)}`,
    amount: Math.floor(Math.random() * 1000),
  };

  console.log('📤 Created transaction:', tx);
  transactionPool.push(tx);
  broadcast({ type: 'TX', tx });
}, 7000);
