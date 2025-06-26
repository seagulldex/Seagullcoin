import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);
const PORT = process.env.PORT || 3001;
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];

let db;
let blockchain = [];
let transactionPool = [];
let blockchainCollection;
let txPoolCollection;
const sockets = [];

async function connectDB() {
  try {
    await client.connect();
    db = client.db('gossipDB');
    blockchainCollection = db.collection('blockchain');
    txPoolCollection = db.collection('transactionPool');
    console.log('🗄️ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
  }
}

async function loadStateFromDB() {
  const blocks = await blockchainCollection.find({}).sort({ index: 1 }).toArray();
  blockchain = blocks.length ? blocks : [];

  const txs = await txPoolCollection.find({}).toArray();
  transactionPool = txs.length ? txs : [];

  console.log(`🔄 Loaded ${blockchain.length} blocks and ${transactionPool.length} transactions from MongoDB`);
}

async function saveBlock(block) {
  await blockchainCollection.updateOne(
    { index: block.index },
    { $set: block },
    { upsert: true }
  );
}

async function saveTransactionPool() {
  await txPoolCollection.deleteMany({});
  if (transactionPool.length) {
    await txPoolCollection.insertMany(transactionPool);
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
      setTimeout(() => connectToPeer(address), 5000);
    });
  });

  socket.on('error', err => {
    console.error(`⚠️ Connection failed to ${address}:`, err.message);
    setTimeout(() => connectToPeer(address), 5000);
  });
}

async function handleMessage(data, socket) {
  switch (data.type) {
    case 'BLOCK':
      console.log('📦 Received block');
      handleReceivedBlock(data.block);
      broadcast({ type: 'BLOCK', block: data.block }, socket);
      break;
    case 'TX':
      console.log('💸 Received transaction');
      transactionPool.push(data.tx);
      await saveTransactionPool();
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

async function startNode() {
  await connectDB();
  await loadStateFromDB();

  const server = new WebSocketServer({ port: PORT });
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

  peers.forEach(connectToPeer);

  setInterval(async () => {
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

    await saveBlock(block);
    await saveTransactionPool();

    console.log('🚀 New block broadcasted');
    broadcast({ type: 'BLOCK', block });
  }, 15000);

  setInterval(() => {
  for (let i = 0; i < 5; i++) { // ⬅️ Emit 5 tx every interval
    const tx = {
      from: `Node-${PORT}`,
      to: `Wallet-${Math.floor(Math.random() * 1000)}`,
      amount: Math.floor(Math.random() * 1000),
    };

    console.log('📤 Created TX:', tx);
    transactionPool.push(tx);
    broadcast({ type: 'TX', tx });
  }, 3000);
}

startNode().catch(console.error);
