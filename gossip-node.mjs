import { WebSocketServer } from 'ws';
import WebSocket from 'ws'; // Optional, if you're also using it for client connections
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);
const PORT = process.env.PORT || 3001;
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];

let db;
let blockchain = [];
let transactionPool = [];

const server = new WebSocketServer({ port: PORT }); // ✅ Fix here
const sockets = [];

async function connectDB() {
  try {
    await client.connect();
    db = client.db('gossipDB'); // your DB name
    blockchainCollection = db.collection('blockchain');
    txPoolCollection = db.collection('transactionPool');
    console.log('🗄️ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
  }
}


console.log(`🌐 Node started on ws://localhost:${PORT}`);

server.on('connection', socket => {
  console.log('✅ New peer connected');
  sockets.push(socket);

  socket.on('message', msg => {
    const data = JSON.parse(msg);
    handleMessage(data, socket);
  });

  socket.on('close', () => {
    console.log('❌ Peer disconnected');
    sockets.splice(sockets.indexOf(socket), 1);
  });
});

function connectToPeer(address) {
  const socket = new WebSocket(address);

  socket.on('open', () => {
    console.log(`🔌 Connected to peer: ${address}`);
    sockets.push(socket);

    socket.on('message', msg => {
      const data = JSON.parse(msg);
      handleMessage(data, socket);
    });

    socket.on('close', () => {
      console.log(`❌ Lost connection to ${address}`);
      sockets.splice(sockets.indexOf(socket), 1);
      setTimeout(() => connectToPeer(address), 5000); // 🔁 retry
    });
  });

  socket.on('error', err => {
    console.error(`⚠️ Connection failed to ${address}:`, err.message);
    setTimeout(() => connectToPeer(address), 5000); // 🔁 retry
  });
}


function handleMessage(data, socket) {
  switch (data.type) {
    case 'BLOCK':
      console.log('📦 Received block');
      handleReceivedBlock(data.block);
      broadcast({ type: 'BLOCK', block: data.block }, socket);
      break;
    case 'TX':
      console.log('💸 Received transaction');
      transactionPool.push(data.tx);
      broadcast({ type: 'TX', tx: data.tx }, socket);
      break;
    default:
      console.warn('❓ Unknown type:', data.type);
  }
}

function handleReceivedBlock(block) {
  if (!blockchain.length || block.previousHash === getLatestHash()) {
    blockchain.push(block);
    console.log('✅ Block accepted');
  } else {
    console.warn('⚠️ Block rejected: bad previousHash');
  }
}

function getLatestHash() {
  return blockchain.at(-1)?.hash || '0';
}

function broadcast(message, exclude) {
  sockets.forEach(s => {
    if (s !== exclude && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(message));
    }
  });
}

peers.forEach(connectToPeer);

setInterval(() => {
  if (transactionPool.length === 0) return;

  const block = {
    index: blockchain.length,
    timestamp: Date.now(),
    transactions: transactionPool,
    previousHash: getLatestHash(),
    hash: (Math.random() + '').slice(2),
  };

  blockchain.push(block);
  transactionPool = [];

  console.log('🚀 New block broadcasted');
  broadcast({ type: 'BLOCK', block });
}, 15000);

setInterval(() => {
  const tx = {
    from: `Node-${PORT}`,
    to: `Wallet-${Math.floor(Math.random() * 1000)}`,
    amount: Math.floor(Math.random() * 1000),
  };

  console.log('📤 Created TX:', tx);
  transactionPool.push(tx);
  broadcast({ type: 'TX', tx });
}, 7000);
