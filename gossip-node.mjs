import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { createHash } from 'crypto';
import { StateManager } from './blockchain/StateManager.js'; // adjust path if needed
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// --- Constants ---
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3001;
const PEERS = process.env.PEERS ? process.env.PEERS.split(',') : [];

const DB_NAME = 'gossipDB';
const BLOCK_COLLECTION = 'blockchain';
const TX_POOL_COLLECTION = 'transactionPool';

const BLOCK_MAX_TX = 100;
const BLOCK_INTERVAL_MS = 15000;
const TX_GENERATION_INTERVAL_MS = 3000;
const TPS_LOG_INTERVAL_MS = 10000;
const PEER_RECONNECT_DELAY_MS = 5000;
const DB_CONNECT_RETRY_LIMIT = 5;
const DB_CONNECT_RETRY_DELAY_MS = 2000;

// --- Globals ---
const client = new MongoClient(MONGO_URI);
let db;
let blockchain = [];
let transactionPool = [];
let blockchainCollection;
let txPoolCollection;
let stateManager;
const sockets = [];

let confirmedTxCount = 0;
let lastTPSCheck = Date.now();
let txCount = 0; // Total tx processed/sent for TPS tracking

// --- Utility: Simple validation ---
function isValidTx(tx) {
  return tx &&
    typeof tx.txId === 'string' &&
    typeof tx.from === 'string' &&
    typeof tx.to === 'string' &&
    typeof tx.amount === 'number' &&
    tx.amount > 0;
}

function isValidBlock(block) {
  return block &&
    typeof block.index === 'number' &&
    typeof block.timestamp === 'number' &&
    Array.isArray(block.transactions) &&
    typeof block.previousHash === 'string' &&
    typeof block.hash === 'string' &&
    block.transactions.every(isValidTx);
}

// --- DB Connection with retries ---
async function connectDB(retries = 0) {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    blockchainCollection = db.collection(BLOCK_COLLECTION);
    txPoolCollection = db.collection(TX_POOL_COLLECTION);
    console.log('🗄️ Connected to MongoDB');
  } catch (err) {
    console.error(`❌ MongoDB connection failed (attempt ${retries + 1}):`, err.message);
    if (retries < DB_CONNECT_RETRY_LIMIT) {
      await new Promise(res => setTimeout(res, DB_CONNECT_RETRY_DELAY_MS));
      return connectDB(retries + 1);
    } else {
      throw new Error('Failed to connect to MongoDB after multiple attempts');
    }
  }
}

async function loadStateFromDB() {
  const blocks = await blockchainCollection.find({}).sort({ index: 1 }).toArray();
  blockchain = blocks.length ? blocks : [];

  const txs = await txPoolCollection.find({}).toArray();
  transactionPool = txs.length ? txs : [];
  // Initialize state
  stateManager = new StateManager();
  stateManager.initializeFromBlockchain(blockchain);

  
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
  if (transactionPool.length === 0) return;

  const operations = transactionPool.map(tx => ({
    updateOne: {
      filter: { txId: tx.txId },
      update: { $set: tx },
      upsert: true,
    },
  }));

  await txPoolCollection.bulkWrite(operations);
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

function calculateBlockHash(block) {
  const blockString = block.index + block.timestamp + JSON.stringify(block.transactions) + block.previousHash;
  return createHash('sha256').update(blockString).digest('hex');
}

function connectToPeer(address) {
  const socket = new WebSocket(address);

  socket.on('open', () => {
    console.log(`🔌 Connected to peer: ${address}`);
    sockets.push(socket);

    socket.on('message', msg => {
      try {
        const data = JSON.parse(msg);
        handleMessage(data, socket);
      } catch (e) {
        console.warn('❌ Failed to parse message:', e.message);
      }
    });

    socket.on('close', () => {
      console.log(`❌ Lost connection to ${address}`);
      sockets.splice(sockets.indexOf(socket), 1);
      setTimeout(() => connectToPeer(address), PEER_RECONNECT_DELAY_MS);
    });
  });

  socket.on('error', err => {
    console.error(`⚠️ Connection failed to ${address}:`, err.message);
    setTimeout(() => connectToPeer(address), PEER_RECONNECT_DELAY_MS);
  });
}

async function handleMessage(data, socket) {
  switch (data.type) {
    case 'BLOCK':
      if (isValidBlock(data.block)) {
        try {
          // Try applying block to state manager before accepting
          stateManager.applyBlock(data.block);

          console.log('📦 Received valid block');
          handleReceivedBlock(data.block);
          broadcast({ type: 'BLOCK', block: data.block }, socket);
        } catch (err) {
          console.warn('❌ Failed to apply block to state:', err.message);
        }
      } else {
        console.warn('❌ Invalid block received, ignoring');
      }
      break;

        case 'TX':
      if (isValidTx(data.tx)) {
        try {
          // Optional: Use stateManager to validate transaction (e.g. balances)
          if (!stateManager.isValidTransaction(data.tx)) {
            console.warn('❌ Transaction invalid by state validation, ignoring');
            break;
          }

    const exists = transactionPool.some(tx => tx.txId === data.tx.txId);
          if (!exists) {
            transactionPool.push(data.tx);
            txCount++;
            await saveTransactionPool();
            broadcast({ type: 'TX', tx: data.tx }, socket);
          } else {
            console.log('⚠️ Duplicate TX ignored');
          }
        } catch (err) {
          console.warn('❌ Error validating transaction:', err.message);
        }
      } else {
        console.warn('❌ Invalid transaction received, ignoring');
      }
      break;

    default:
      console.warn('❓ Unknown message type:', data.type);
  }
}

function handleReceivedBlock(block) {
  if (
    !blockchain.length ||
    (block.previousHash === getLatestHash() && block.index === blockchain.length)
  ) {
    blockchain.push(block);
    try {
      stateManager.applyBlock(block);  // <-- Keep stateManager in sync
    } catch (err) {
      console.warn(`❌ Failed to apply block to stateManager: ${err.message}`);
    }
    console.log(`✅ Block accepted (#${block.index})`);
  } else {
    console.warn(`⚠️ Block rejected (index: ${block.index}, expected: ${blockchain.length})`);
  }
}

async function startNode() {
  await connectDB();
  await txPoolCollection.createIndex({ txId: 1 }, { unique: true });
  await blockchainCollection.createIndex({ index: 1 }, { unique: true });
  await loadStateFromDB();

  const server = new WebSocketServer({ port: PORT });
  console.log(`🌐 Node started on ws://localhost:${PORT}`);

  const MESSAGE_DROP_RATE = 0.1;   // 10% messages dropped
  const MAX_DELAY_MS = 200;        // up to 200ms delay

  server.on('connection', socket => {
    console.log('✅ New peer connected');
    sockets.push(socket);

    socket.on('message', msg => {
      if (Math.random() < MESSAGE_DROP_RATE) {
        console.log('⚠️ Simulated message drop');
        return; // drop the message randomly
      }
      setTimeout(() => {
        try {
          const data = JSON.parse(msg);
          handleMessage(data, socket);
        } catch (e) {
          console.warn('❌ Failed to parse message:', e.message);
        }
      }, Math.random() * MAX_DELAY_MS);
    });

    socket.on('close', () => {
      console.log('❌ Peer disconnected');
      sockets.splice(sockets.indexOf(socket), 1);
    });
  });

  PEERS.forEach(connectToPeer);

  // --- Place the intervals here ---
  // Create block every BLOCK_INTERVAL_MS ms
  setInterval(async () => {
    if (transactionPool.length === 0) return;

    const block = {
      index: blockchain.length,
      timestamp: Date.now(),
      transactions: transactionPool.splice(0, BLOCK_MAX_TX),
      previousHash: getLatestHash(),
    };
    block.hash = calculateBlockHash(block);
    blockchain.push(block);
    transactionPool = [];

    await saveBlock(block);
    await saveTransactionPool();

    console.log(`🚀 Block #${block.index} with ${block.transactions.length} txs`);
    broadcast({ type: 'BLOCK', block });

    confirmedTxCount += block.transactions.length;
    const now = Date.now();
    const elapsed = (now - lastTPSCheck) / 1000;
    if (elapsed >= TPS_LOG_INTERVAL_MS / 1000) {
      const tps = confirmedTxCount / elapsed;
      console.log(`📊 TPS: ${tps.toFixed(2)} tx/sec`);
      confirmedTxCount = 0;
      lastTPSCheck = now;
    }
  }, BLOCK_INTERVAL_MS);

  // Generate 10 tx every TX_GENERATION_INTERVAL_MS ms
  setInterval(() => {
    for (let i = 0; i < 10; i++) {
      const tx = {
        txId: randomUUID(),
        from: `Node-${PORT}`,
        to: `Wallet-${Math.floor(Math.random() * 1000)}`,
        amount: Math.floor(Math.random() * 1000),
      };

      transactionPool.push(tx);
      txCount++;
      broadcast({ type: 'TX', tx });
    }
  }, TX_GENERATION_INTERVAL_MS);

  // TPS and stats logger every 5 seconds
  setInterval(() => {
    console.log(`📦 Chain Height: ${blockchain.length - 1}`);
    console.log(`💰 Pool Size: ${transactionPool.length}`);
    console.log(`📈 Total TXs Sent: ${txCount}`);
  }, 5000);
}

startNode().catch(console.error);
