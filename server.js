// ===== Imports =====
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { NFTStorage, File } from 'nft.storage';
import xrpl from 'xrpl';
import NodeCache from 'node-cache';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import axios from 'axios';
import { acceptOffer, rejectOffer } from './mintingLogic.js';
import { body, query, validationResult } from 'express-validator';
import { XummSdk } from 'xumm-sdk';
import { verifyXummPayload, createNftOfferPayload, getUserInfo } from './xumm-utils.js';
import { createNftOffer } from './xrpl-utils.js'
import pkg from 'xumm-sdk';
import { mintNFT } from './nftminting.js';
import checkSeagullCoinBalance from './checkSeagullCoinBalance.js'; // Import the checkSeagullCoinBalance function
import FormData from 'form-data'; // For handling file uploads
import { verifyXummSignature, createXummPayment } from './xummApi.js'; // Import XUMM functions
import mintRouter from './mint-endpoint.js'; // Your mint endpoint router
import swaggerJSDoc from 'swagger-jsdoc';
import { processXummMinting } from './confirmPaymentXumm.js';
import { confirmPayment } from './confirmPaymentXumm.js';
import mime from 'mime';
import { xummApi } from './xrplClient.js';
import { initiateLogin, verifyLogin } from './xummLogin.js';  // Assuming the path is correct
import { requireLogin } from './xummLogin.js';  // Adjust the path if needed
import { createTables, addOwnerWalletAddressToNFTsTable } from './dbsetup.js';
import { Buffer } from 'buffer';
import { insertMintedNFT } from './dbsetup.js';
import sanitizeHtml from 'sanitize-html';
import rippleAddressCodec from 'ripple-address-codec';
const { isValidAddress } = rippleAddressCodec;
// Initialize XUMM SDK using environment variables
import('rippled-ws-client').then(({ default: RippledWsClient }) => {
  const client = new RippledWsClient('wss://xrplcluster.com');
  // Your logic here
});
    


// Initialize the database tables
createTables();




// Import your business logic modules
import { client, fetchNFTs } from './xrplClient.js';
import { addListing, getNFTDetails, unlistNFT, getAllNFTListings } from './nftListings.js';
import { OfferModel } from './models/offerModel.js';
import { NFTModel } from './models/nftModel.js';  // Added a new model for NFT management
import { MongoClient, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { fetchSeagullCoinBalance } from './xrplClient.js';
import { promisify } from 'util'; // 
import { RippleAPI } from 'ripple-lib';
import { Client } from 'xrpl';
import { fetchSeagullOffers } from "./offers.js";
import Stripe from 'stripe';
import { randomBytes } from 'crypto';
import Wallet from './models/Wallet.js';
import crypto from 'crypto';
import { hashSeed } from './utils/test-hash.js';
import { createGenesisBlock } from './blockchain/utils.js';
import Block from './models/Block.js';
import { calculateHash } from './blockchain/utils.js';
import PendingTransaction from './models/PendingTransaction.js';
import ValidatorNode from './models/ValidatorNode.js';
import { signBlock } from './utils/signBlock.js'; // existing
import { verifySignature } from './utils/verifySignature.js';
import UserWallet from './models/Wallet.js'; // assuming file is still Wallet.js
import { connectDB } from './connectDB.js'; // ✅ Update path to match your file structure
import { fetchAllNFTs } from './helpers/fetchAllNFTs.js';
import SGLCNXAUPrice from './models/SGLCNXAUPrice.js';
import './Xauprice.js'; // or whatever your file with setInterval is
import './priceTrackerSGLCNXRP.js';

dotenv.config();

const xummSDK = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const SEAGULL_COIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"; // Issuer address
const SEAGULL_COIN_CODE = "SeagullCoin"; // Currency code

const SEAGULL_COIN_LABEL = "SGLCN"; // Token identifier (SeagullCoin trustline)
const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY;
const nftData = requireLogin.body;
const sessions = {};

const app = express();
const port = process.env.PORT || 3000;
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI, SGLCN_ISSUER, SERVICE_WALLET } = process.env;
const db = new sqlite3.Database('./database.db');
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
const router = express.Router();
const xrplClient = new Client('wss://xrplcluster.com');
const nftCache = new Map(); // key: wallet address, value: { data, timestamp }
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const STAKING_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U'; // Your staking service wallet
const token = randomBytes(32).toString('hex')

const usedPayloads = new Set(); // In-memory cache to prevent reuse
const stakes = {}; // Format: { walletAddress: { uuid, amount, status } }

const PRIVATE_KEY_PEM = fs.readFileSync(path.resolve('./keys/private.pem'), 'utf-8');
const PUBLIC_KEY_PEM = fs.readFileSync(path.resolve('./keys/public.pem'), 'utf-8');


const api = new RippleAPI({ server: 'wss://s2.ripple.com' });

async function fetchIPFSMetadata(uri) {
  if (!uri.startsWith("ipfs://")) return null;
  const ipfsUrl = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  try {
    const res = await fetch(ipfsUrl);
    if (!res.ok) throw new Error("Failed to fetch metadata from IPFS");
    const metadata = await res.json();
    return {
      name: metadata.name || "Untitled NFT",
      description: metadata.description || "",
      image: metadata.image?.startsWith("ipfs://")
        ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
        : metadata.image || ""
    };
  } catch (err) {
    console.error("IPFS metadata fetch error:", err.message);
    return {
      name: "Untitled NFT",
      description: "",
      image: ""
    };
  }
}

// Fetch SGLCN-XRP price from the AMM pool



async function createStakePayload(req, res, amount) {
  try {
    const db = await connectDB();
    const stakesCollection = db.collection('stakes');

    const walletAddress = req.params.walletAddress;

    if (!walletAddress || !walletAddress.startsWith('r')) {
      return res.status(400).json({ error: 'Invalid or missing wallet address' });
    }

    const payloadResponse = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U', // Replace with your actual staking wallet
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000', // Hex for "SeagullCoin"
          issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
          value: amount
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('Yearly', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(walletAddress, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      options: {
        submit: true,
        expire: 10
      }
    });

    const stakeData = {
      walletAddress,
      amount: Number(amount),
      timestamp: new Date(),
      xummPayloadUUID: payloadResponse.uuid
    };

    await stakesCollection.insertOne(stakeData);

    if (!payloadResponse?.uuid) {
      throw new Error('XUMM payload creation failed');
    }

    res.json(payloadResponse);

  } catch (error) {
    console.error('Error creating stake payload:', error);
    res.status(500).json({ error: 'Failed to create stake payload' });
  }
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'nft_marketplace_nfts',
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB connected');
    //
    // await mongoose.connection.close(); 
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
})();


async function fetchAndSavePrice() {
  const client = new Client('wss://s2.ripple.com');
  try {
    await client.connect();

    const ammResponse = await client.request({
      command: 'amm_info',
      asset: { currency: 'XAU', issuer: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ' },
      asset2: { currency: '53656167756C6C436F696E000000000000000000', issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno' }
    });

    const amm = ammResponse.result.amm;
    if (!amm || !amm.amount || !amm.amount2) {
      console.error('AMM pool not found or invalid.');
      return;
    }

    const xau = parseFloat(amm.amount.value);
    const sglcn = parseFloat(amm.amount2.value);

    const newPrice = new SGLCNXAUPrice({
      sglcn_to_xau: xau / sglcn,
      xau_to_sglcn: sglcn / xau
    });

    await newPrice.save();
    console.log(`Saved price at ${newPrice.timestamp}`);
  } catch (err) {
    console.error('Error fetching or saving price:', err.message);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}


function calculateEarnings(entry) {
  const { timestamp, tier } = entry;
  const now = new Date();
  const start = new Date(timestamp);
  const daysElapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));

  let dailyRate = 0;
  if (tier === 'Monthly') dailyRate = 16.7;
  else if (tier === '1 Year') dailyRate = 171.23;
  else if (tier === '5 Year') dailyRate = 547.94;

  const earned = dailyRate * daysElapsed;
  return earned;
}

const privateKeyPem = fs.readFileSync('./keys/private.pem', 'utf8');

try {
  crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8',
  });
  console.log('✅ Private key loaded successfully');
} catch (err) {
  console.error('❌ Private key error:', err.message);
}

async function createValidator() {
  // Connect to MongoDB (adjust connection string)
  await mongoose.connect('mongodb://localhost:27017/your-db-name');

  // Load your public key PEM
  const PUBLIC_KEY_PEM = fs.readFileSync(path.resolve('./keys/public.pem'), 'utf-8');

  // Create ValidatorNode entry if not exists
  const existing = await ValidatorNode.findOne({ nodeId: 'seagull-validator-1' });
  if (!existing) {
    await ValidatorNode.create({
      nodeId: 'seagull-validator-1',
      publicKey: PUBLIC_KEY_PEM,
      trusted: true,
    });
    console.log('✅ Validator node created');
  } else {
    console.log('Validator node already exists');
  }

  await mongoose.disconnect();
}

createValidator().catch(console.error);


// Generate RSA key pair (2048 bits)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log('Dummy Private Key PEM:\n', privateKey);
console.log('Dummy Public Key PEM:\n', publicKey);


async function init() {
  const Block = mongoose.model('Block');
  const genesis = await Block.findOne({ index: 0 });

  if (!genesis) {
    console.log('Creating genesis block...');
    await createGenesisBlock();
  }
}

init(); // 🔥 Call the async function

// 1. Simulated pending transactions store (in-memory or DB)


// 2. Function to mine a block
async function mineBlock(transactions, privateKeyPem, validatorId) {
  const previousBlock = await Block.findOne().sort({ index: -1 });
  if (!previousBlock) {
    console.error('❌ Genesis block not found.');
    return;
  }

  const newBlock = new Block({
    index: previousBlock.index + 1,
    previousHash: previousBlock.hash,
    timestamp: new Date(),
    transactions,
    nonce: 0,
  });

  newBlock.hash = calculateHash(newBlock.toObject());

  // Sign the block hash
  const signature = signBlock(newBlock.hash, privateKeyPem);

  // Attach signature and validator reference
  newBlock.signatures = [{ validator: validatorId, signature }];

  await newBlock.save();

  console.log(`✅ Block #${newBlock.index} mined and signed with ${transactions.length} txs`);
}


// 3. Auto-mine loop every 10 seconds
setInterval(async () => {
  const txsToMine = await PendingTransaction.find().limit(100); // Limit if needed
  if (txsToMine.length === 0) return;

  try {
    await mineBlock(txsToMine);

    // Remove mined transactions
    const ids = txsToMine.map(tx => tx._id);
    await PendingTransaction.deleteMany({ _id: { $in: ids } });

  } catch (err) {
    console.error('❌ Auto-mining failed:', err);
    // Optional: mark as failed or keep retrying
  }
}, 10_000);



// Generator Function
export async function generateCustomWallet() {
  const uniquePart = randomBytes(12).toString('hex').toUpperCase();
  const wallet = `SEAGULL${uniquePart}`;

  const seed = randomBytes(32).toString('hex');
  const hashedSeed = hashSeed(seed);

  const newWallet = new Wallet({
    wallet,
    seed,
    hashed_seed: hashedSeed,
    xrpl_address: '', // Optional or required based on your schema
  });

  await newWallet.save();

  console.log("✅ Created wallet:", wallet);
  return newWallet;
}




// ✅ Define the schema + model at the top
const giftCardOrderSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true },
  brand: String,
  amount: Number,
  priceSGLCN: Number,
  wallet: String,
  recipientEmail: String,
  status: { type: String, default: 'pending' },
  fulfilledAt: Date,
}, { timestamps: true });

const GiftCardOrder = mongoose.model('GiftCardOrder', giftCardOrderSchema);


async function getStakes() {
  const client = new xrpl.Client("wss://s1.ripple.com");
  await client.connect();

  const response = await client.request({
    command: "account_tx",
    account: STAKING_WALLET,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: 50
  });

  const stakes = response.result.transactions
    .filter(tx => tx.tx.TransactionType === "Payment")
    .filter(tx => tx.tx.Amount.currency === "53656167756C6C436F696E000000000000000000") // SeagullCoin
    .filter(tx => {
      const memo = tx.tx.Memos?.[0]?.Memo;
      const type = Buffer.from(memo?.MemoType, 'hex').toString();
      return type === "stake";
    })
    .map(tx => ({
      from: tx.tx.Account,
      amount: tx.tx.Amount.value,
      duration: Buffer.from(tx.tx.Memos[0].Memo.MemoData, 'hex').toString(), // e.g. "30d"
      txHash: tx.tx.hash,
      timestamp: tx.tx.date
    }));

  await client.disconnect();
  return stakes;
}



// Function to get balance for a single address
const getBalance = async (address) => {
  const url = `https://s2.ripple.com:51234/`;  // This is the public XRP ledger API URL (Ripple)
  
  const requestData = {
    "method": "account_lines",
    "params": [{
      "account": address
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData)
  });

  const data = await response.json();
  console.log(`Balance data for ${address}:`, data);
  return data;
};

// Function to get balance for all users
const getAllUserBalances = async (userAddresses) => {
  const balancePromises = userAddresses.map(address => getBalance(address));  // Iterate over addresses
  const allBalances = await Promise.all(balancePromises);  // Wait for all balances to be fetched
  console.log('All user balances:', allBalances);
};

// Fetch user addresses from the SQLite database
const getUserAddressesFromDatabase = async () => {
  return new Promise((resolve, reject) => {
    const addresses = [];
    db.all('SELECT address FROM users', [], (err, rows) => {
      if (err) {
        reject(err);
      }
      rows.forEach((row) => {
        addresses.push(row.address);
      });
      resolve(addresses);
    });
  });
};



// Fetch user addresses from the database and get their balances
const fetchAndCheckUserBalances = async () => {
  try {
    const userAddressesFromDb = await getUserAddressesFromDatabase();
    await getAllUserBalances(userAddressesFromDb);
  } catch (err) {
    console.error('Error fetching user addresses or balances:', err);
  }
};

// Call the function to fetch and check balances for all users
fetchAndCheckUserBalances();



const payments = {};



/**
 * Confirm a XUMM payment was signed and meets all SGLCN minting criteria.
 * @param {string} payloadUUID - The XUMM payload UUID from the client.
 * @param {string} expectedSigner - The wallet address of the user.
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


// Create the transactions table if it doesn't exist
db.serialize(() => {
  

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        nft_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,  -- (mint, buy, sell, transfer)
        amount REAL NOT NULL,  -- SeagullCoin amount
        status TEXT NOT NULL,  -- (success, failed)
        transaction_hash TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS signed_payloads`);
  db.run(`
    CREATE TABLE signed_payloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      txid TEXT,
      signed_at TEXT,
      wallet TEXT
    )
  `);
});


// 2. Then later insert/read as needed
const uuid = 'some-uuid';
const txid = 'some-txid';
const wallet = 'rExampleWalletAddress';
const signedAt = new Date().toISOString();

db.run(
  `INSERT INTO signed_payloads (uuid, txid, signed_at, wallet) VALUES (?, ?, ?, ?)`,
  [uuid, txid, signedAt, wallet],
  function(err) {
    if (err) {
      console.error('Insert error:', err);
    } else {
      console.log('Inserted row with id:', this.lastID);

      db.get(
        `SELECT * FROM signed_payloads WHERE id = ?`,
        [this.lastID],
        (err, row) => {
          if (err) {
            console.error('Select error:', err);
          } else {
            const signedAtDate = new Date(row.signed_at);
            console.log('Parsed signed_at:', signedAtDate.toString());
          }
        }
      );
    }
  }
);



// Initialize SQLite database
const dbPromise = open({
  filename: './payments.db', // Database file name
  driver: sqlite3.Database
});

// Create a table for payments if it doesn't exist
async function createPaymentTable() {
  const db = await dbPromise;
  await db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payloadUUID TEXT UNIQUE,
      senderAddress TEXT,
      amount REAL,
      currency TEXT,
      status TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

createPaymentTable().catch(console.error);

// Create the Messages table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId TEXT NOT NULL,
      receiverId TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'unread'
    )
  `);
});

// Create the staking table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS staking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    walletAddress TEXT NOT NULL,
    amount REAL NOT NULL,
    duration INTEGER NOT NULL,
    startTime INTEGER NOT NULL,
    endTime INTEGER NOT NULL,
    status TEXT NOT NULL,
    rewards REAL DEFAULT 0
  )
`);

// Create the user_profiles table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        avatar_url TEXT,
        email TEXT,
        wallet_address TEXT UNIQUE NOT NULL
    )
  `);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS nfts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_uri TEXT NOT NULL
    )
  `);
});

// Initialize SQLite Database
const initDB = async () => {
  // Open the database asynchronously
  db = await open({
    filename: './payloads.db',
    driver: sqlite3.Database,
  });

  // Create table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS used_payloads (
      uuid TEXT PRIMARY KEY,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const start = async () => {
  try {
    // Correctly using await inside an async function
    await initDB(); 
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing DB:', err);
  }
};

// Call the start function
start();


// Cleanup expired or rejected payloads
const cleanupExpiredPayloads = async () => {
  try {
    // Set the expiration threshold (e.g., 24 hours ago)
    const expirationThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    // Delete expired payloads based on creation time or status
    await db.run(
      `DELETE FROM used_payloads WHERE createdAt < ? OR meta_signed = false`,
      expirationThreshold
    );

    console.log('Expired or rejected payloads have been cleaned up.');
  } catch (err) {
    console.error('Error during payload cleanup:', err);
  }
};

initDB();
// Mark payload as used in the database
const markPayloadUsed = async (uuid) => {
  await db.run(`INSERT OR IGNORE INTO used_payloads (uuid) VALUES (?)`, uuid);
};

// Check if payload is already used
const isPayloadUsed = async (uuid) => {
  const row = await db.get(`SELECT 1 FROM used_payloads WHERE uuid = ?`, uuid);
  return !!row;
};

// 1. **Swagger Definition** (Swagger configuration)
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SeagullCoin NFT Minting API',
    version: '1.0.0',
    description: 'API documentation for minting NFTs with SeagullCoin payment',
  },
  servers: [
    {
      url: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app', // Change this URL when deploying
    },
  ],
};

// 2. **Swagger Setup** (Create options and generate Swagger spec)
const options = {
  swaggerDefinition,
  apis: ['./mint-endpoint.js'], // Point to your API files (mint-endpoint.js)
};



// ===== Multer Setup =====
// Setup multer to handle file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    const mimeType = mime.getType(file.originalname);
    // Only allow image files (you can add more types if needed)
    if (!mimeType || !mimeType.startsWith('image/')) {
      return cb(new Error('Invalid file type. Only images are allowed.'));
    }
    cb(null, true); // Accept the file
  },
}).single('file'); // Expect a single file to be uploaded with the field name 'file'

// ===== Rate Limiting =====
const limiter = rateLimit({
  windowMs: 30 * 100 * 50000,
  max: 100000,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

// ===== Middleware =====
// First session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
  maxAge: 5 * 60 * 1000,  // 5 minutes
  secure: true,           // Ensure cookie is sent only over HTTPS
  httpOnly: true          // Helps with security by making the cookie inaccessible to JavaScript
    }
}));

// Now, apply other middleware
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const mintLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // limit each IP to 3 mints per 10 minutes
  message: {
    success: false,
    message: 'Too many mint attempts from this IP, please try again later.'
  }
});

//====== Token TOML =======

const tokens = [
  {
    code: "SeagullCoin",
    issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno",
    network: "main",
    desc: "The Gold Standard of the Bored Seagull Club ecosystem. SeagullCoin acts as the plumbing of our Ecosystem, with pairing to XRP, and highly liquid to XAU. SeagullCoin is the perfect long-term hedge asset with future collateral loan utility.",
    icon: "https://pbs.twimg.com/profile_images/1874512448151314432/Axe_9hCH_400x400.jpg",
    symbol: "SGLCN",
    token_hex: "53656167756C6C436F696E000000000000000000"
  },
  {
    code: "SeagullMansions",
    issuer: "rHr4mUQjRusoNNYnzCp5BFumyWjycgVHJS",
    network: "main",
    desc: "SeagullMansions are tokens redeemable for NFTs of luxurious properties in the Bored Seagull Club Metaverse.",
    icon: "https://www.gravatar.com/psychicpeanut6bcb9b1a78",
    symbol: "SGLMSN",
    token_hex: "53656167756C6C4D616E73696F6E730000000000"
  },
  {
    code: "SeagullCash",
    issuer: "rNHeGnj4kqGSVyFzDcoyi3gsp1bdPuGeNK",
    network: "main",
    desc: "SeagullCash is a payment system for Person to Person payments with future UBI and NFC integration.",
    icon: "https://www.gravatar.com/avatar/f00a8c2ebf24897e0de7a2d0028ac06e",
    symbol: "SGLCSH",
    token_hex: "53656167756C6C43617368000000000000000000"
  },
  {
    code: "SeagullApartments",
    issuer: "rKjevbXgCs6sP8XTLz6SgcE5RKCLuiS1r3",
    network: "main",
    desc: "SeagullApartments are tokens redeemable for Apartment NFTs in the Bored Seagull Club Metaverse.",
    icon: "https://cdn.xrp.cafe/689b2eca1128-4387-9abf-8f03693f75f4.webp",
    symbol: "SGLAPRT",
    token_hex: "53454147554C4C41504152544D454E5453000000"
  }
];

app.get("/tokens", (req, res) => {
  res.json(tokens);
});

// ===== Swagger Docs =====
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ===== SQLite Init =====

// Ensure the tables for users and messages exist
db.serialize(() => {
  // Create users table if it doesn't exist
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");

  // Create messages table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const saveNFTToDatabase = (walletAddress, name, description, metadataUri) => {
  const query = `
    INSERT INTO nfts (walletAddress, name, description, metadataUri)
    VALUES (?, ?, ?, ?)
  `;
  
  db.run(query, [walletAddress, name, description, metadataUri], function(err) {
    if (err) {
      console.error('Error saving NFT to database:', err.message);
    } else {
      console.log(`NFT saved with ID: ${this.lastID}`);
    }
  });
};// Insert a test user
  const stmt = db.prepare("INSERT INTO users (name) VALUES (?)");
  stmt.run('SeagullCoin User');
  stmt.finalize();
});

// 1. Get all posts (for the community board)
app.get('/api/posts', (req, res) => {
  db.all('SELECT * FROM posts ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).send('Error retrieving posts');
      return;
    }
    res.json(rows); // Return all posts as JSON
  });
});

// 2. Create a new post
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  
  if (!username || !content) {
    return res.status(400).send('Username and content are required');
  }

  const stmt = db.prepare('INSERT INTO posts (username, content) VALUES (?, ?)');
  stmt.run(username, content, function (err) {
    if (err) {
      return res.status(500).send('Error creating post');
    }
    // Respond with the newly created post's data (including auto-generated ID)
    res.status(201).json({
      id: this.lastID,
      username,
      content,
      created_at: new Date().toISOString(),
    });
  });
  stmt.finalize();
});

app.use('/api', mintRouter);  // Assuming mintRouter handles your mint-related endpoints

router.get("/active-offers/:wallet", async (req, res) => {
  const wallet = req.params.wallet;

  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(wallet)) {
    return res.status(400).json({ error: "Invalid XRPL address" });
  }

  const offers = await fetchSeagullOffers(wallet);
  res.json({ wallet, offers });
});

app.get('/login', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: "SignIn" }
    });

    req.session.payloadUUID = payload.uuid;

    res.status(200).json({
      payloadUUID: payload.uuid,
      payloadURL: payload.next.always
    });

    // OPTIONAL: wait in background for sign-in to complete
    // or do this on a separate /callback or /verify endpoint
  } catch (err) {
    console.error('Error initiating login:', err);
    res.status(500).json({ error: 'Error initiating login' });
  }
});


app.post('/stake', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

  await addStake(wallet);
  res.json({ success: true, message: 'Stake registered', wallet });
});


app.get('/stake-payload/:walletAddress', async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const amount = '50000'; // Fixed amount
    const tier = 'Monthly';
    const lockupDays = 30;
    const now = new Date();

    if (!walletAddress || !walletAddress.startsWith('r')) {
      return res.status(400).json({ error: 'Invalid or missing wallet address' });
    }

    const db = await connectDB();
    const stakesCollection = db.collection('stakes');

    const payloadResponse = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U', // Your staking service wallet
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000', // Hex for "SeagullCoin"
          issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
          value: '50000'
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('Monthly', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(walletAddress, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      options: {
        submit: true,
        expire: 10
      }
    });

    if (!payloadResponse?.uuid) {
      throw new Error('XUMM payload creation failed - no UUID');
    }

  const stakeData = {
      walletAddress,
      amount: Number(amount),
      timestamp: now,
      stakeEndDate: new Date(now.getTime() + lockupDays * 24 * 60 * 60 * 1000),
      xummPayloadUUID: payloadResponse.uuid,
      tier,
      status: 'pending'
    };

    await stakesCollection.insertOne(stakeData);

    // ✅ Wait 2 seconds and fetch status (or use a longer delay + client-side polling for UX)
    setTimeout(async () => {
      try {
        const payloadDetails = await xumm.payload.get(payloadResponse.uuid);
        const wasSigned = payloadDetails?.meta?.resolved && payloadDetails?.meta?.signed;

        if (wasSigned) {
          await stakesCollection.updateOne(
            { xummPayloadUUID: payloadResponse.uuid },
            { $set: { status: 'confirmed' } }
          );
          console.log(`✅ Payload ${payloadResponse.uuid} signed and confirmed.`);
        } else {
          console.log(`🕓 Payload ${payloadResponse.uuid} still pending or was rejected.`);
        }
      } catch (pollErr) {
        console.error('❌ Failed to check XUMM payload status:', pollErr.message);
      }
    }, 2000);
    
    return res.json(payloadResponse);

  } catch (error) {
    console.error('❌ Error creating XUMM stake payload:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message
    });

    return res.status(500).json({
      error: 'Failed to create stake payload',
      details: error?.response?.data?.message || error.message
    });
  }
});

// Endpoint: Stake status by wallet
app.get('/stake-status/:wallet', async (req, res) => {
  const wallet = req.params.wallet;
  try {
    const stake = await getStake(wallet);
    if (!stake) return res.json({ staked: false, wallet });

    const startTime = new Date(stake.staked_at);
    const durationDays = 30; // Staking period
    const endTime = new Date(startTime);
    endTime.setDate(startTime.getDate() + durationDays);

    res.json({
      staked: true,
      wallet: stake.wallet_address,
      amount: '500.00', // Fixed stake amount in SeagullCoin
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${durationDays} days`,
      timeRemaining: msToTime(endTime - new Date())
    });

  } catch (err) {
    res.status(500).json({ error: 'DB error', details: err.message });
  }
});





app.get('/stake-rewards/:walletAddress', async (req, res) => {
  const wallet = req.params.walletAddress;

  const stake = await getStake(wallet);
  if (!stake) return res.json({ eligible: false, message: 'Wallet not staked' });

  const now = Date.now();
  const daysStaked = Math.floor((now - stake.stakedAt) / (1000 * 60 * 60 * 24));
  const cappedDays = Math.min(daysStaked, 30); // Cap to 30 days max
  const reward = (cappedDays * DAILY_REWARD).toFixed(2);

  res.json({
    wallet,
    daysStaked: cappedDays,
    reward: Number(reward),
    unlocksAt: new Date(stake.unlocksAt).toISOString(),
    eligible: now >= stake.unlocksAt
  });
});



app.post('/claim-rewards/:walletAddress', async (req, res) => {
  const wallet = req.params.walletAddress;
  const stake = stakedWallets[wallet];
  if (!stake) return res.status(400).json({ error: 'Wallet not staked' });

  const stakedDays = Math.floor((Date.now() - stake.stakedAt) / (1000 * 60 * 60 * 24));
  if (stakedDays < 1) return res.status(400).json({ error: 'No rewards available yet' });

  const rewardAmount = (stakedDays * 16.7).toFixed(0); // total reward in whole SGLCN

  // Create XUMM payload to send rewardAmount SeagullCoin to wallet
  try {
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: "Payment",
        Destination: wallet,
        Amount: {
          currency: "53656167756C6C436F696E000000000000000000",
          issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno",
          value: rewardAmount
        }
      }
    });

    // Reset staking timer or update stakedAt after payout
    stakedWallets[wallet].stakedAt = Date.now();

    res.json({
      message: `Reward payout payload created for ${rewardAmount} SeagullCoin`,
      uuid: payload.uuid,
      next: payload.next,
      refs: payload.refs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payout payload', details: err.message });
  }
});


app.get('/unstake-payload/:wallet', async (req, res) => {
  const wallet = req.params.wallet;

  try {
    const stake = await getStake(wallet);
    if (!stake) {
      return res.status(400).json({ error: 'Wallet is not staked' });
    }

    const now = Date.now();
    if (now < stake.unlocksAt) {
      return res.status(400).json({
        error: 'Tokens are still locked',
        unlocksAt: new Date(stake.unlocksAt).toISOString(),
        message: `Tokens will be unlocked after ${new Date(stake.unlocksAt).toDateString()}`
      });
    }

    // Build XUMM payload to send 52,400 SeagullCoin from service wallet to user
    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Account: process.env.SERVICE_WALLET,
        Destination: stake.walletAddress,
        Amount: {
          currency: 'SeagullCoin',
          issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
          value: '50500'
        }
      },
      options: {
        submit: true,
        expire: 10
      }
    };

    const created = await xumm.payload.create(payload);

    res.json({
      message: 'Unstake payload created',
      payload: created,
      unlocksAt: new Date(stake.unlocksAt).toISOString()
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to create unstake payload', details: err.message });
  }
});



app.get('/user', async (req, res) => {
  const address = req.query.address;
  if (!address) return res.status(400).json({ error: 'Missing address' });

  try {
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    const trustlines = await client.request({
      command: 'account_lines',
      account: address
    });

    const hasTrustline = trustlines.result.lines.some(
      line => line.currency === 'SeagullCoin' && line.issuer === SGLCN_ISSUER
    );

    const balanceLine = trustlines.result.lines.find(
      line => line.currency === 'SeagullCoin' && line.issuer === SGLCN_ISSUER
    );

    const balance = balanceLine ? balanceLine.balance : '0';

    const nftResponse = await client.request({
      command: 'account_nfts',
      account: address
    });

    const offersResponse = await client.request({
      command: 'nft_sell_offers',
      nft_id: nftResponse.result.account_nfts.map(n => n.NFTokenID)
    }).catch(() => ({ result: { offers: [] } }));

    res.json({
      wallet: address,
      hasTrustline,
      balance,
      nfts: nftResponse.result.account_nfts,
      offers: offersResponse.result.offers || []
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

app.get('/gravatar/:hash', async (req, res) => {
  const { hash } = req.params;

  try {
    const response = await fetch(`https://xpcdn.xpmarket.com/gravatars/${hash}.png`);

    if (!response.ok) {
      throw new Error('Gravatar not found');
    }

    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(buffer));
  } catch (err) {
    // fallback image if XPMarket doesn't have one
    res.redirect('/fallback.png'); // or send a default image from your server
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Ensure views are stored in /views
app.get('/confirm-login/:payloadUUID', async (req, res) => {
  try {
    const { payloadUUID } = req.params;
    const { data: payload } = await xummApi.payload.get(payloadUUID);

    if (payload.meta.signed) {
      const walletAddress = payload.response.account;
      req.session.walletAddress = walletAddress;
      res.json({ success: true, walletAddress });
    } else {
      res.json({ success: false, message: 'Payload not signed' });
    }
  } catch (error) {
    console.error('Login confirmation failed:', error);
    res.status(500).json({ error: 'Login confirmation error' });
  }
});
// Protected route to check if the user is logged in before proceeding
app.get('/dashboard', requireLogin, (req, res) => {
  // If this route is reached, the user is logged in (because of requireLogin middleware)
  res.json({ success: true, message: 'Welcome to your dashboard!', user: req.user });
});

// Example: Marking a payload as used (could be triggered by a request)
app.post('/payload', async (req, res) => {
  const { uuid } = req.body;

  if (await isPayloadUsed(uuid)) {
    return res.status(400).send('Payload has already been used.');
  }

  // Mark the payload as used
  await markPayloadUsed(uuid);

  res.status(200).send('Payload marked as used.');
});function isValidXRPAddress(address) {
  return isValidAddress(address);
}
router.post('/mint', async (req, res) => {
  const { walletAddress, nftData, txId } = req.body;

  // Early validation for wallet and NFT data
  if (!walletAddress || !isValidXRPAddress(walletAddress)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid wallet address. Please check and try again.',
    });
  }

  if (!nftData || !nftData.name || !nftData.description || !nftData.filename || !nftData.fileBase64) {
    return res.status(400).json({
      success: false,
      message: 'Required NFT data is missing. Please provide valid name, description, filename, and file.',
    });
  }
  
  const cleanText = (text) => {
  const sanitized = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();

  // Optional: Keep common emoji characters (non-stripping by default)
  return sanitized.replace(/[\u0000-\u001F\u007F]+/g, ''); // removes control chars
};
  
  nftData.name = cleanText(nftData.name);
  nftData.description = cleanText(nftData.description);

  // Payment Confirmation Step
  // Step 1: Confirm the payment with the given txId
    try {
      const paymentConfirmation = await confirmPayment(txId); // Await the confirmPayment function
      if (!paymentConfirmation.success) {
        return res.status(400).json({
          success: false,
          message: paymentConfirmation.reason,
        });
      }
    } catch (error) {
  console.error('Error confirming payment:', error.message, 'TxID:', txId); // <-- Add it here
  return res.status(500).json({
    success: false,
    message: 'Error confirming the payment.',
  });
}

  // NFT data validation
  try {
    Buffer.from(nftData.fileBase64, 'base64');
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file data. Please make sure your file is properly encoded in base64.',
    });
  }

  const base64Size = Buffer.from(nftData.fileBase64, 'base64').length;
  if (base64Size > 5 * 1024 * 1024) { // 5MB limit
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the 5MB limit. Please reduce the size and try again.',
    });
  }

  // Process NFT minting
  try {
    const mintResult = await mintNFT(walletAddress, nftData);
    console.log('Mint result:', mintResult);
    if (!mintResult.uri.startsWith('ipfs://')) {
      return res.status(500).json({
        success: false,
        message: 'Minting failed. Invalid IPFS URI returned.',
      });
    }

    // Insert minted NFT into DB
    try {
      await insertMintedNFT({
        wallet: walletAddress,
        token_id: mintResult.tokenId,
        uri: mintResult.uri,
        name: nftData.name,
        description: nftData.description,
        properties: JSON.stringify(nftData.properties || {}),
        collection_id: nftData.collectionId || null,
      });
      console.log('NFT successfully stored in DB.');
    } catch (err) {
      console.error('Error saving NFT to DB:', err);
      return res.status(500).json({
        success: false,
        message: 'Error saving NFT data to the database.',
      });
    }
    return res.status(200).json({
      success: true,
      nftStorageUrl: mintResult.uri,
      mintPayloadUrl: mintResult.uri,
      mintPayloadId: mintResult.uriHex,
    });

  } catch (error) {
    console.error('Minting process failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during the minting process. Please try again later.',
    });
  }
});

app.get('/db-schema', async (req, res) => {
  try {
    const rows = await db.all("PRAGMA table_info(staking);");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get('/mint-history/:wallet', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  
  const { wallet } = req.params;
  db.all(`SELECT * FROM minted_nfts WHERE wallet = ? ORDER BY id DESC`, [wallet], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    res.json({ success: true, nfts: rows });
  });
});

app.get('/health', async (req, res) => {
  try {
    const connected = client.isConnected();
    res.status(200).json({
      status: connected ? 'ok' : 'disconnected',
      xrpl: connected,
      uptime: process.uptime().toFixed(2) + 's',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: API is healthy
 */

// Assuming XummSdk is initialized already

// Endpoint to start the XUMM authentication
app.get('/auth', async (req, res) => {
    try {
        // Generate an authentication payload
        const payload = await xummSDK.payload.create({
            txjson: {
                "TransactionType": "AccountSet",
                "Account": "user-wallet-address"  // This should be replaced with actual user data if needed
            }
        });

        // Send the URL for the user to authenticate
        res.json({ url: payload?.next.always });  // Redirect URL for the user to approve
    } catch (error) {
        console.error('Error creating XUMM authentication payload:', error);
        res.status(500).json({ error: 'Error initiating XUMM authentication.' });
    }
});// ===== Listing NFT Route =====


app.post('/login', async (req, res) => {
  const { xummPayload } = req.body;

  try {
    const verifiedPayload = await verifyXummPayload(xummPayload);

    if (verifiedPayload) {
      const walletAddress = verifiedPayload.account;

      // Set session variable for the user
      req.session.walletAddress = walletAddress;
      req.session.
      res.status(200).json({ success: true, message: 'User authenticated', walletAddress });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: 'Payload verification failed' });
  }
});

async function getUserAddress() {
    try {
        const result = await xumm.ping();  // Example of checking connection to XUMM
        const userAddress = result.user.address;  // Adjust based on actual response structure

        // Now you can use userAddress
        console.log(userAddress);
        requireLogin.session.userAddress = userAddress;  // Store in session
    } catch (err) {
        console.error('Error getting user address:', err);
    }
}

app.get("/login/status", async (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) return res.status(400).json({ error: "Missing uuid" });

  try {
    const result = await xumm.payload.get(uuid);

    if (result.meta.signed === true) {
      const wallet = result.response.account;
      return res.json({ signed: true, wallet });
    } else if (result.meta.signed === false) {
      return res.json({ signed: false, rejected: true });
    } else {
      return res.json({ signed: false, pending: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to check login status", details: err.message });
  }
});

// Create a login payload (step before user signs in with XUMM)
app.get('/create-login-payload', async (req, res) => {
  try {
    const payload = {
      txjson: {
        TransactionType: "SignIn"
      }
    };

    const created = await xumm.payload.create(payload);

    res.json({
      payloadUUID: created.uuid,
      payloadURL: created.next.always
    });
  } catch (err) {
    console.error('Error creating login payload:', err);
    res.status(500).json({ error: 'Failed to create login payload' });
  }
});

app.post('/api/xumm-login', async (req, res) => {
    const payload = {
        "txjson": {
            "TransactionType": "AccountSet",
            "Account": "your-xrp-address",
            // other transaction details if necessary
        }
    };

    try {
        // Create the payload
        const createdPayload = await xummSDK.payload.create(payload);

        // Return the payload UUID and URL to the frontend so the user can sign the payload in the XUMM app
        res.json({
            payloadUUID: createdPayload.uuid,
            payloadURL: `https://xumm.app/sign/${createdPayload.uuid}`
        });

        // Polling to check if the user has signed the payload
        const checkPayloadStatus = async () => {
            const response = await xummSDK.payload.get(createdPayload.uuid);
            if (response.meta.signed) {
                // The user has signed the payload, handle the login
                const walletAddress = response.txjson.Account; // This should be the wallet address
                // Log the user in by storing the wallet address in session or local storage
                res.status(200).json({
                    message: 'User logged in',
                    walletAddress: walletAddress
                });
            } else {
                // User did not sign the transaction
                res.status(400).json({ message: 'User did not sign the transaction' });
            }
        };

        // Wait for the user to sign the payload (you can use a timeout or polling)
        setTimeout(checkPayloadStatus, 5000); // You may want to adjust the timeout or use another method like polling

    } catch (error) {
        console.error('Error creating XUMM payload:', error);
        res.status(500).json({ error: 'Failed to create XUMM payload' });
    }
});

app.get('/api/check-login', async (req, res) => {
  console.log("Session Data:", req.session); // Debugging
  const payloadUUID = req.session.xummPayload;

  if (!payloadUUID) {
    return res.status(401).json({ error: 'No login session found.' });
  }

  const userAddress = await verifyLogin(payloadUUID);
  if (!userAddress) {
    return res.status(401).json({ error: 'User has not signed the payload.' });
  }

  // Save user address in session for future use
  req.session.userAddress = userAddress;

  return res.json({
    loggedIn: true,
    address: userAddress
  });
});

// server.js



app.use('/fallback.png', express.static(path.join(__dirname, 'public/fallback.png')));


app.post('/list', async (req, res) => {
  const { nftokenId, price, duration } = req.body;

  try {
    const listing = await addListing(nftokenId, price, duration);
    res.json({ success: true, listing });
  } catch (err) {
    console.error('Listing error:', err);
    res.status(500).json({ error: 'Failed to list NFT.', message: err.message });
  }
});


/**
 * @swagger
 * /nft/{nftokenId}:
 *   get:
 *     summary: Get NFT details by token ID
 *     parameters:
 *       - in: path
 *         name: nftokenId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: NFT data retrieved
 */


app.get('/listings', async (req, res) => {
  const listings = await getAllNFTListings();
  res.json({ success: true, listings });
});

/**
 * @swagger
 * /api/list-nft:
 *   post:
 *     summary: List an NFT for sale
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftId:
 *                 type: string
 *               sellerAddress:
 *                 type: string
 *               price:
 *                 type: number
 *                 example: 0.5
 *     responses:
 *       200:
 *         description: NFT listed for sale successfully
 *       400:
 *         description: Invalid data or insufficient SeagullCoin
 */



// Accept an offer
app.post('/accept-offer', async (req, res) => {
  const { offerId, userAddress, nftId } = req.body;

  if (!offerId || !userAddress || !nftId) {
    return res.status(400).json({ error: 'Offer ID, user address, and NFT ID are required.' });
  }

  try {
    const result = await acceptOffer(offerId);

    db.run("UPDATE nfts SET owner_address = ? WHERE id = ?", [userAddress, nftId], (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'Offer accepted and NFT ownership updated.' });
    });
  } catch (err) {
    console.error('Error accepting offer:', err);
    res.status(500).json({ error: 'Failed to accept offer.', message: err.message });
  }
});
/**
 * @swagger
 * /accept-offer:
 *   post:
 *     summary: Accept an NFT offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               offerId:
 *                 type: string
 *               userAddress:
 *                 type: string
 *               nftId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Offer accepted
 */
// Reject an offer
app.post('/reject-offer', async (req, res) => {
  const { offerId, nftokenId } = req.body;

  if (!offerId) {
    return res.status(400).json({ error: 'Offer ID is required.' });
  }

  try {
    await rejectOffer(nftokenId, offerId);
    res.json({ success: true, message: 'Offer rejected.' });
  } catch (err) {
    console.error('Error rejecting offer:', err);
    res.status(500).json({ error: 'Failed to reject the offer.', message: err.message });
  }
});

/**
 * @swagger
 * /reject-offer:
 *   post:
 *     summary: Reject an NFT offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               offerId:
 *                 type: string
 *               nftokenId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Offer rejected
 */

// Buy NFT

// Example function to handle NFT purchase logic
async function buyNFT(nftId, buyerAddress, paymentAmount) {
  // Logic to process the purchase
  // Example: Check if the user has enough funds, validate NFT availability, etc.
  console.log(`Processing purchase for NFT with ID: ${nftId} by user: ${buyerAddress} for ${paymentAmount} SeagullCoin`);

console.log(requireLogin.session); // Log session data to verify its content

app.get('/login-status', async (req, res) => {
  const uuid = req.session.payloadUUID;
  if (!uuid) return res.status(400).json({ error: "No login session found" });

  const payload = await xumm.payload.get(uuid);

  if (payload.meta.signed) {
    const wallet = payload.response.account;
    req.session.user = { wallet }; // Save wallet to session
    return res.json({ loggedIn: true, wallet });
  } else if (payload.meta.cancelled) {
    return res.json({ loggedIn: false, cancelled: true });
  } else {
    return res.json({ loggedIn: false, waiting: true });
  }
});

app.get('/db-test', (req, res) => {
  db.all('SELECT * FROM staking', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});


function calculateDaysStaked(stake) {
  const now = Date.now();
  const start = stake.startTime;
  const durationMs = stake.duration * 24 * 60 * 60 * 1000; // duration in ms
  const elapsed = now - start;
  const daysStakedSoFar = Math.min(Math.floor(elapsed / (24 * 60 * 60 * 1000)), stake.duration);
  const eligible = elapsed >= durationMs;
  return { daysStakedSoFar, eligible };
}


// Open SQLite DB (async/await friendly)
(async () => {
  db = await open({
    filename: './staking.db',
    driver: sqlite3.Database
  });
const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table';");
console.log(tables);

  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS staking (
      wallet TEXT PRIMARY KEY,
      stakedAt INTEGER,
      unlocksAt INTEGER,
      amount INTEGER
    )
  `);
})();

(async () => {
  const rows = await db.all('SELECT wallet, stakedAt, unlocksAt, amount FROM staking');
  rows.forEach(row => {
    stakedWallets[row.wallet] = {
      stakedAt: row.stakedAt,
      unlocksAt: row.unlocksAt,
      amount: row.amount
    };
  });
})();


// Constants
const STAKE_AMOUNT = 50000;           // 50000 SeagullCoin staked
const LOCK_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days in ms
const DAILY_REWARD = 80;            // 80 SeagullCoin per day reward

// Add stake (called after successful stake signed)
async function addStake(wallet) {
  const stakedAt = Date.now();
  const unlocksAt = stakedAt + LOCK_PERIOD_MS;
  const amount = STAKE_AMOUNT;

  await db.run(`
    INSERT OR REPLACE INTO staking (wallet, stakedAt, unlocksAt, amount)
    VALUES (?, ?, ?, ?)
  `, [wallet, stakedAt, unlocksAt, amount]);
}

// Get stake by wallet
async function getStake(wallet) {
  return db.get(`SELECT * FROM staking WHERE wallet = ?`, [wallet]);
}
    // Example: Return success or failure (replace with actual logic)
  return { success: true, message: 'Purchase successful' };
}app.post('/buy-nft', async (req, res) => {
  const { userAddress, nftId, price } = req.body;

  try {
    // Step 1: Check SeagullCoin balance before proceeding with the buy
    const accountLines = await client.request({
      method: 'account_lines',
      params: [{ account: userAddress }],
    });

    const line = accountLines.result.lines.find(l =>
      l.currency === SEAGULL_COIN_CODE && l.issuer === SEAGULL_COIN_ISSUER
    );

    const balance = line ? parseFloat(line.balance) : 0;

    if (balance < price) {
      return res.status(400).json({ error: 'Insufficient SeagullCoin balance for buying this NFT.' });
    }

    // Step 2: Perform the buy action logic (e.g., deducting SeagullCoin and transferring NFT)
    // You would likely want to transfer the SeagullCoin from the buyer to the seller here

    // Assuming the action was successful, log the transaction
    logTransaction(userAddress, nftId, 'buy', price, 'success');

    res.status(200).json({ message: 'NFT bought successfully.' });

  } catch (error) {
    console.error('Error buying NFT:', error);
    logTransaction(userAddress, nftId, 'buy', price, 'failed');
    res.status(500).json({ error: 'Failed to buy NFT.' });
  }
});/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: Buy an NFT using SeagullCoin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftId:
 *                 type: string
 *                 example: "0008000086E5FC84AB3A58D2C8DFF83AD3F59D16E0135FDFDA23B6E300000001"
 *               buyerAddress:
 *                 type: string
 *                 example: "rEXAMPLEBUYERADDRESS1234567890ABCDEF"
 *               priceInSeagullCoin:
 *                 type: number
 *                 example: 0.5
 *     responses:
 *       200:
 *         description: NFT purchased successfully
 *       400:
 *         description: Validation error or failed purchase
 *       500:
 *         description: Server error
 */

// Helper function to log transactions
function logTransaction(userAddress, nftId, transactionType, amount, status, transactionHash = null) {
  const stmt = db.prepare(`
    INSERT INTO transactions (user_address, nft_id, transaction_type, amount, status, transaction_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(userAddress, nftId, transactionType, amount, status, transactionHash, function (err) {
    if (err) {
      console.error('Error logging transaction:', err);
    } else {
      console.log('Transaction logged successfully');
    }
  });
  stmt.finalize();
}

// Update profile picture
app.post('/update-profile-picture', async (req, res) => {
  const { walletAddress } = req.session;
  const profilePic = req.file;

  if (!walletAddress || !profilePic) {
    return res.status(400).json({ error: 'Missing wallet address or profile picture.' });
  }

  try {
    const ipfsResult = await nftStorage.store({ file: profilePic.path });
    const profilePicUrl = ipfsResult.url;
    await updateUserProfile(walletAddress, { profilePicUrl });
    res.json({ success: true, profilePicUrl });
  } catch (err) {
    console.error('Error updating profile picture:', err);
    res.status(500).json({ error: 'Failed to update profile picture.' });
  }
});

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update user's profile (name, avatar, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               profileData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   avatar:
 *                     type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid data or error updating profile
 */
app.put('/api/user/profile', async (req, res) => {
  // update-user-profile logic here
});
/**
 * @swagger
 * /update-profile:
 *   post:
 *     summary: Update user profile details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletAddress:
 *                 type: string
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */

// Endpoint to upload avatar
app.post('/upload-avatar', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'File upload failed', details: err.message });
    }
    
    const avatarPath = `/uploads/${req.file.filename}`;  // Path to the uploaded file
    const walletAddress = req.body.wallet_address;  // Assuming the wallet address is passed in the body

    // Save avatar path and wallet address in user_profiles table
    db.run(
      `UPDATE user_profiles SET avatar_url = ? WHERE wallet_address = ?`,
      [avatarPath, walletAddress],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database update failed', details: err.message });
        }
        res.json({ message: 'Avatar uploaded successfully', avatarUrl: avatarPath });
      }
    );
  });
});

// Endpoint to update username

async function updateUserProfile(walletAddress, newProfileData) {
  // Replace this with actual DB logic
  // Example: Update user in your database
  console.log(`Updating profile for ${walletAddress}:`, newProfileData);

  // Simulate successful update
  return { success: true, message: 'Profile updated' };
}app.post('/update-username', async (req, res) => {
  const { walletAddress } = req.session;
  const { username } = req.body;

  if (!username) return res.status(400).json({ error: 'Username is required.' });

  try {
    // Save to user profile in your DB (or session storage)
    await updateUserProfile(walletAddress, { username });

    res.json({ success: true, username });
  } catch (err) {
    console.error('Error updating username:', err);
    res.status(500).json({ error: 'Failed to update username.' });
  }
});
/**
 * @swagger
 * /update-username:
 *   post:
 *     summary: Update a user's display name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletAddress:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Username updated successfully
 */
// Like an NFT
async function likeNFT(walletAddress, nftId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM nft_likes WHERE walletAddress = ? AND nftId = ?', [walletAddress, nftId], (err, row) => {
      if (err) {
        return reject(err);
      }
      if (row) {
        return reject(new Error('NFT already liked by this user.'));
      }
      // Insert new like
    });
  });
}// Insert new// Like NFT endpoint
app.post('/like-nft',
  body('nftokenId').isString().isLength({ min: 10 }).withMessage('Invalid NFT ID'),
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nftokenId } = req.body;
    const walletAddress = req.session?.walletAddress;

    // Ensure wallet is connected
    if (!walletAddress) return res.status(401).json({ error: 'Wallet not connected.' });

    try {
      // Perform the database operation wrapped in a promise
      const result = await new Promise((resolve, reject) => {
        // Insert new like into the database
        db.run('INSERT INTO nft_likes (walletAddress, nftId) VALUES (?, ?)', [walletAddress, nftokenId], function(err) {
          if (err) return reject(err);  // Reject if there's an error
          resolve({ success: true });   // Resolve on success
        });
      });// Return the success result to the client
      res.status(200).json(result);

    } catch (error) {
      // Handle any errors
      console.error(error);
      res.status(500).json({ error: 'An error occurred while liking the NFT' });
    }
  });/**
 * @swagger
 * /api/like-nft:
 *   post:
 *     summary: Like an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftId:
 *                 type: string
 *               userAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: NFT liked successfully
 *       400:
 *         description: Invalid data or already liked
 */
async function getTotalCollections() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS total FROM collections', (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row.total);
    });
  });
}

app.get('/gettotalcollections', async (req, res) => {
    // Logic to get the total number of collections
    const totalCollections = await getTotalCollections(); // Replace with actual logic
    res.json({ totalCollections });
});

/**
 * @swagger
 * /api/stats/collections:
 *   get:
 *     summary: Get total number of NFT collections
 *     responses:
 *       200:
 *         description: Total collections retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 10
 */
app.get('/api/stats/collections', async (req, res) => {
  // get-total-collections logic here
});

app.get('/gettotalusers', async (req, res) => {
    // Logic to get the total number of users
    const totalUsers = await getTotalUsers(); // Replace with actual logic
    res.json({ totalUsers });
});

/**
 * @swagger
 * /api/stats/users:
 *   get:
 *     summary: Get total number of users
 *     responses:
 *       200:
 *         description: Total users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 500
 */
app.get('/api/stats/users', async (req, res) => {
  // get-total-users logic here
});


// Get platform metrics

// Get total users
async function getTotalUsers() {
  // Logic to get the total number of users (for example, querying a database)
  // Here's a mock example, replace with actual logic
  return 500;  // Replace with your actual logic to fetch user count
}

// Example for SQLite:
async function getTotalNFTs() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM nfts', (err, row) => {
      if (err) return reject(err);
      resolve(row.count);
    });
  });
}


app.get('/metrics', async (req, res) => {
  try {
    const totalNFTs = await getTotalNFTs();
    const totalCollections = await getTotalCollections();
    const totalUsers = await getTotalUsers();

    res.json({
      totalNFTs,
      totalCollections,
      totalUsers,
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics.' });
  }
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get platform metrics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */


// ========= Messages =============


// ========= Messages =============

// POST endpoint to send a message
app.post('/send-message', async (req, res) => {
  const { sender, recipient, messageContent } = req.body;

  if (!sender || !recipient || !messageContent) {
    return res.status(400).json({ error: 'Sender, recipient, and message content are required.' });
  }

  try {
    const query = `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?)`;
    await db.run(query, [sender, recipient, messageContent]);

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ===== Get Recently Minted NFTs =====
app.get('/recent', async (req, res) => {
  try {
    const recentNFTs = await fetchNFTs();  // Assuming you have a method to fetch recently minted NFTs
    res.json({ recentNFTs });
  } catch (err) {
    console.error('Error fetching recent NFTs:', err);
    res.status(500).json({ error: 'Failed to fetch recent NFTs.' });
  }
});
/**
 * @swagger
 * /recent:
 *   get:
 *     summary: Get recently minted NFTs
 *     responses:
 *       200:
 *         description: Recent NFTs retrieved
 */

// Get all NFTs for the logged-in user

async function getUserNFTs(walletAddress) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM nfts WHERE walletAddress = ? ORDER BY mintDate DESC', [walletAddress], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}app.get('/user-nfts', async (req, res) => {
  const { walletAddress } = req.session;

  try {
    const nfts = await getUserNFTs(walletAddress); // Function to fetch NFTs for a user
    res.json({ nfts });
  } catch (err) {
    console.error('Error fetching NFTs:', err);
    res.status(500).json({ error: 'Failed to fetch NFTs.' });
  }
});

/**
 * @swagger
 * /getusernfts:
 *   get:
 *     summary: Get NFTs for a specific wallet address
 *     parameters:
 *       - in: query
 *         name: walletAddress
 *         schema:
 *           type: string
 *         required: false
 *         description: Wallet address to fetch NFTs for
 *     responses:
 *       200:
 *         description: NFTs retrieved
 */
app.get('/getusernfts',
  query('walletAddress').optional().isString().isLength({ min: 25 }).withMessage('Invalid wallet address'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { walletAddress } = req.query;
    try {
      const nfts = await getUserNFTs(walletAddress);
      res.json({ nfts });
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      res.status(500).json({ error: 'Failed to fetch NFTs.' });
    }
  }
);
// Get a list of all collections

// Example for MongoDB:
// Example for SQLite:
async function getAllCollections() {
  return new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT collection_name FROM nfts', (err, rows) => {  // Adjust the query based on your database structure
      if (err) return reject(err);
 
      resolve(rows.map(row => row.collection_name)); // Assuming collection_name is the column that stores collection names
    });
  });
}


/**
 * @swagger
 * /collections:
 *   get:
 *     summary: Get public NFT collections
 *     responses:
 *       200:
 *         description: Public collections retrieved
 */



/**
 * @swagger
 * /getallcollections:
 *   get:
 *     summary: Get all NFT collections
 *     responses:
 *       200:
 *         description: Collections retrieved successfully
 */

// Create a collection
app.post('/create-collection',
  body('name').isString().isLength({ min: 1, max: 100 }).withMessage('Collection name is required'),
  body('description').optional().isString().isLength({ max: 300 }),
  body('icon').isURL().withMessage('Collection icon must be a valid URL'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, icon } = req.body;

    try {
      db.run("INSERT INTO collections (name, description, icon) VALUES (?, ?, ?)",
        [name, description || '', icon],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Database insert failed.' });
          }
          res.json({ success: true, collectionId: this.lastID });
        });
    } catch (err) {
      console.error('Error creating collection:', err);
      res.status(500).json({ error: 'Failed to create collection.' });
    }
});

// Endpoint to verify signed payload
 app.post('/verify-authentication', async (req, res) => {
  const { signedPayload } = req.body;

  if (!signedPayload) {
    return res.status(400).json({ error: 'Missing signed payload' });
  }

  try {
    // Decode the signed payload to get user information
    const response = await xummSDK.payload.decode(signedPayload);
    const { account } = response;

    // Store account in session for future API calls
    req.session.walletAddress = account;

    res.json({ success: true, walletAddress: account });
  } catch (error) {
    console.error('Error verifying signed payload:', error);
    res.status(500).json({ error: 'Failed to verify authentication' });
  }
});
// XUMM OAuth callback route
app.get('/xumm/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code.' });
  }

  try {
    const response = await fetch('https://xumm.app/api/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${XUMM_CLIENT_ID}:${XUMM_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: XUMM_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to obtain access token.');
    }

    const data = await response.json();
    req.session.xumm = data; // Store XUMM response in session
    req.session.walletAddress = data.account; // Store wallet address

    // Log success and redirect user to a success page (or dashboard)
    console.log('OAuth2 success, user authenticated:', data.account);

    res.redirect('/'); // Or any page you want after login
  } catch (err) {
    console.error('XUMM OAuth callback error:', err);
    res.status(500).json({ error: 'OAuth callback processing failed.' });
  }
});

// Endpoint to confirm payment after XUMM wallet transaction
app.get('/confirm-payment', async (req, res) => {
  const { payloadUuid } = req.query;

  if (!payloadUuid) {
    return res.status(400).send('Missing payloadUuid');
  }

  try {
    // Call confirmPayment from confirmPaymentxumm.js to verify payment
    await confirmPayment(payloadUuid); // This will handle the confirmation logic
    
    // If payment is successful, proceed with minting or other actions
    res.send('Payment confirmed and processed');
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).send('Failed to confirm payment');
  }
})

// Endpoint to initiate the authentication
app.get('/authenticate', async (req, res) => {
  try {
    const payload = {
      "TransactionType": "SignIn",
      "Destination": "https://seagullcoin-dex-uaj3x.ondigitalocean.app",
      "Account": req.session.walletAddress // Optional: can pass existing wallet if user is logged in
    };

    // Create the XUMM payload
    const createdPayload = await xummSDK.payload.create(payload);
    const { uuid } = createdPayload;

    // Send UUID back to frontend to open XUMM for signing
    res.json({
      uuid,
      redirectUrl: `https://xumm.app/sign/${uuid}`
    });
  } catch (error) {
    console.error('Error creating XUMM authentication payload:', error);
    res.status(500).json({ error: 'Failed to create authentication payload' });
  }
});

app.post('/xumm-login-callback', async (req, res) => {
  const { signedPayload } = req.body;  // Assume the signed payload is returned from XUMM

  try {
    const userData = await xummSDK.getUserTokenData(signedPayload);  // Use the XUMM SDK to get user info

    if (userData?.sub) {
      // Wallet address is stored as 'sub' in the user data
      const walletAddress = userData.sub;

      // Optionally, save wallet address to the database here

      res.json({ success: true, walletAddress });
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Error processing XUMM callback:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.post('/user', async (req, res) => {
  const { xummToken } = req.body;

  try {
    const userData = await xummSDK.getUserTokenData(xummToken); // Verify the XUMM token

    if (userData?.sub) {
      const account = userData.sub;

      // Store the wallet address and sessionToken in the database
      db.run(`INSERT OR REPLACE INTO users (walletAddress, sessionToken) VALUES (?, ?)`, [account, 'your-session-token'], function(err) {
        if (err) {
          console.error("Error storing user data:", err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }

        console.log('User stored successfully:', account);
        res.json({ success: true, account });
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid user' });
    }
  } catch (err) {
    console.error('Error verifying XUMM token:', err);
    res.status(500).json({ success: false });
  }
});

app.get('/user/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;

  db.get(`SELECT * FROM users WHERE walletAddress = ?`, [walletAddress], (err, row) => {
    if (err) {
      console.error("Error fetching user data:", err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (row) {
      return res.json({ success: true, user: row });
    } else {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
  });
});


app.get('/get-balance/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const response = await client.request({
      command: 'account_lines',
      account: address
    });

    const lines = response.result.lines;

    console.log(`Trustlines for ${address}:`);
    lines.forEach(line => {
      console.log(`- Currency: ${line.currency}, Account: ${line.account}, Balance: ${line.balance}`);
    });

    const seagullCoin = lines.find(line =>
      (line.currency === 'SeagullCoin' ||
       line.currency === '53656167756C6C436F696E000000000000000000') &&
      line.account === 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'
    );

    const balance = seagullCoin ? parseFloat(seagullCoin.balance).toFixed(2) : '0.00';
    res.json({ balance });

  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error?.data || error.message || error);
    res.status(500).json({ error: 'Failed to fetch balance', details: error.message });
  }
});

// Load all NFTs
app.get('/all-nfts', (req, res) => {
  const filePath = path.join(__dirname, 'data/nfts.json');
  
  // Check if the file exists before reading it
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading NFT data file:', err);
      return res.status(500).json({ error: 'Could not load NFTs' });
    }

    let allNFTs = [];
    try {
      allNFTs = JSON.parse(data);
    } catch (parseError) {
      console.error('Error parsing NFT data:', parseError);
      return res.status(500).json({ error: 'Error parsing NFT data' });
    }

    // Optional: Filter NFTs that are paid with SeagullCoin
    const seagullNFTs = allNFTs.filter(nft => nft.paidWith === 'SeagullCoin');
    
    // Respond with the filtered or all NFTs
    res.json(seagullNFTs);
  });
});

app.get('/.well-known/xrp-ledger.toml', (req, res) => {
  const tomlPath = path.join(__dirname, '.well-known', 'xrp-ledger.toml');
  fs.readFile(tomlPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Could not read TOML file');
    }
    res.set('Content-Type', 'text/plain');
    res.send(data);
  });
});

app.get('/balance/:address', async (req, res) => {
  const address = req.params.address;

  const data = {
    method: "account_lines",
    params: [
      {
        account: address,
        limit: 10,
        ledger_index: "validated",
        currency: "53656167756C6C436F696E000000000000000000"
      }
    ]
  };

  try {
    // Call the XRP Ledger API
    const response = await fetch('https://s1.ripple.com:51234', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.result && result.result.lines) {
      // Find the SeagullCoin balance in the response
      const seagullCoin = result.result.lines.find(line => line.currency === "53656167756C6C436F696E000000000000000000");

      if (seagullCoin) {
        res.json({
          address: address,
          balance: seagullCoin.balance
        });
      } else {
        res.json({
          address: address,
          balance: null,
          reason: "No SeagullCoin trustline found"
        });
      }
    } else {
      res.json({
        address: address,
        balance: null,
        reason: result.error || "Error retrieving data"
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// POST route to start the login flow
app.post('/api/start-login', async (req, res) => {
  const { payloadUUID } = req.body;

  // Check if payloadUUID is provided
  if (!payloadUUID) {
    return res.status(400).json({ error: 'Payload UUID is required.' });
  }

  // Store payloadUUID in the session
  req.session.xummPayload = payloadUUID;

  console.log("Session Data after storing UUID:", req.session); // For debugging

  res.json({ success: true, message: 'Login started successfully.' });
});


// Define generateNFTTokenID function
function generateNFTTokenID() {
  return uuidv4();  // Generates a unique UUID for each NFT
}

// Your /add-nft endpoint
app.post('/add-nft', (req, res) => {
  const { name, description, image, collection } = req.body;
  const userWalletAddress = req.body.walletAddress;

  // Generate the NFT token ID
  const nftTokenID = generateNFTTokenID();

  // Create the new NFT object
  const newNFT = {
    id: nftTokenID,
    name: name,
    description: description,
    image: image,  // IPFS URL passed from frontend
    collection: collection || null,
    mintedBy: userWalletAddress,
    paidWith: 'SeagullCoin'
  };

  const filePath = path.join(__dirname, 'data/nfts.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Could not load NFTs' });
    }

    const nftList = data ? JSON.parse(data) : [];
    nftList.push(newNFT);

    fs.writeFile(filePath, JSON.stringify(nftList, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not save NFT' });
      }

      res.json({ message: 'NFT added successfully', newNFT });
    }); // <-- this closes the writeFile function
  }); // <-- this closes the readFile function
}); // <-- this closes the /add-nft endpoint

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).send('Logout failed.');
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.redirect('/index.html');
  });
});

// Example route to fetch SeagullCoin balance for a given wallet address
app.get('/user/balance', async (req, res) => {
    const { walletAddress } = req.query; // Assuming wallet address is passed as a query parameter
    try {
        const balance = await fetchSeagullCoinBalance(walletAddress);
        res.json({ balance: balance.balance });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch balance", message: error.message });
    }
});

const xrplApiUrl = 'https://s1.ripple.com:51234'; // For Mainnet


function resolveIpfsUrl(ipfsUri, gateway = 'https://ipfs.io/ipfs/') {
  if (!ipfsUri) return '';
  if (ipfsUri.startsWith('ipfs://')) {
    return gateway + ipfsUri.slice(7); // remove "ipfs://"
  }
  if (/^[a-zA-Z0-9]{46,}$/.test(ipfsUri)) {
    return gateway + ipfsUri; // raw CID
  }
  return ipfsUri; // fallback, maybe already http
}



// Helper to convert hex-encoded URI to UTF-8 string
function hexToUtf8(hex) {
  if (!hex || typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex)) return '';
  try {
    return Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
  } catch (e) {
    console.error('Invalid hex string:', hex, e.message);
    return '';
  }
}


// Helper for fetch with timeout
const fetchWithTimeout = (url, options = {}, timeout = 7000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    fetch(url, options)
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// Define multiple IPFS gateways
const ipfsGateways = [
  'https://nftstorage.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.infura.io/ipfs/',
  'https://ipfs.io/ipfs/'
];

// Helper to fetch metadata from IPFS with retries
const fetchMetadataWithRetry = async (ipfsUrl, retries = 3) => {
  let attempt = 0;
  let metadata = null;

  while (attempt < retries && !metadata) {
    const gatewayUrl = ipfsGateways[attempt % ipfsGateways.length];  // Cycle through gateways
    const resolvedUrl = resolveIpfsUrl(ipfsUrl, gatewayUrl);

    try {
      const res = await fetchWithTimeout(resolvedUrl, {}, 10000);  // 10 seconds
      if (res.ok) {
        metadata = await res.json();
      } else {
        console.warn(`Non-OK response: ${res.status} from ${resolvedUrl}`);
      }
    } catch (err) {
      console.warn(`Retry attempt ${attempt + 1} failed with ${resolvedUrl}: ${err.message}`);
    }

    attempt++;
  }

  return metadata;
};


// Test route to fetch NFTs for a wallet (limit to 20 NFTs)

app.get('/nfts/:wallet', async (req, res) => {
  const wallet = req.params.wallet;
  console.log(`Fetching NFTs for wallet: ${wallet}`);

  try {
    const existingNFTs = await NFTModel.find({ wallet }).select('-__v').lean();
    console.log(`Found ${existingNFTs.length} NFTs in DB`);

    if (existingNFTs.length > 0) return res.json({ nfts: existingNFTs });

    const rawNFTs = await fetchAllNFTs(wallet);
    if (!Array.isArray(rawNFTs)) {
      console.error('fetchAllNFTs returned:', rawNFTs);
      throw new Error('fetchAllNFTs did not return an array');
    }
    console.log(`Fetched ${rawNFTs.length} NFTs from external source`);

    const parsed = await Promise.all(rawNFTs.slice(0, 20).map(async (nft) => {
      try {
        const uri = hexToUtf8(nft?.URI);
        let metadata = null, collection = null, icon = null;

        if (uri.startsWith('ipfs://')) {
          metadata = await fetchMetadataWithRetry(uri);
          collection = metadata?.collection || metadata?.name || null;
          icon = metadata?.image || null;
        }

        const nftData = {
          NFTokenID: nft.NFTokenID,
          URI: uri,
          collection,
          icon,
          metadata,
          wallet
        };

        await NFTModel.findOneAndUpdate(
          { NFTokenID: nft.NFTokenID },
          nftData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return nftData;
      } catch (nftErr) {
        console.error(`Failed to process NFT ${nft?.NFTokenID}:`, nftErr);
        return null;
      }
    }));

    console.log(`Processed ${parsed.filter(Boolean).length} NFTs successfully`);

    res.json({ nfts: parsed.filter(Boolean) });
  } catch (err) {
    console.error('NFT fetch error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch NFTs' });
  }
});




// /transfer-nft — direct transfer to another wallet
app.post('/transfer-nft', async (req, res) => {
  const { walletAddress, nftId, recipientAddress } = req.body;

  if (!walletAddress || !nftId || !recipientAddress) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }

  try {
    const tx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: walletAddress,
      NFTokenID: nftId,
      Destination: recipientAddress,
      Amount: "0",
      Flags: 1 // 512: tfTransferable (for gifting)
      

    };

    // If you're using XUMM:
    const xummPayload = {
      txjson: tx,
      options: {
        submit: true,
        expire: 5,
      }
    };

    const { created } = await xumm.payload.createAndSubscribe(xummPayload, event => {
      if (event.data.signed === true) return event.data;
    });

    return res.json({
      success: true,
      next: created.next,
      message: `Transfer request created. Sign to complete.`,
    });

  } catch (err) {
    console.error('Transfer NFT error:', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

app.post('/sell-nft', async (req, res) => {
  const { walletAddress, nftId, price } = req.body;

  if (!walletAddress || !nftId || !price) {
    return res.status(400).json({ error: 'Missing walletAddress, nftId, or price' });
  }

  try {

    // The transaction object for the NFT sell offer
    const tx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: walletAddress,
      NFTokenID: nftId,
      Amount: {
        currency: '53656167756C6C43617368000000000000000000', // SeagullCash (Hex code)
        issuer: 'rNHeGnj4kqGSVyFzDcoyi3gsp1bdPuGeNK', // SeagullCash issuer
        value: price.toString(), // Convert price to a string
      },
      Flags: 1, // Ensure you're setting the correct flag for selling
    };

    // Create the payload for XUMM
    const payload = {
      txjson: tx,
      options: {
        submit: true, // Automatically submit after signing
        expire: 60, // Expiration time in seconds
      },
    };

    // Create the payload with XUMM API
    const { uuid, next } = await xumm.payload.create(payload);

    // Return the payload URL and UUID to the client for signing
    return res.json({ next, uuid });

  } catch (err) {
    console.error('Sell NFT error:', err?.data ?? err);
    return res.status(500).json({ error: 'Failed to create sell offer', details: err.message });
  }
});




// XRPL ping function (without disconnecting)
async function xrplPing() {
  try {
    // You should already have an active connection
    const serverInfo = await client.request({ command: 'server_info' });
    console.log("XRPL connection successful", serverInfo);
  } catch (error) {
    console.error("Error connecting to XRPL:", error);
  }
}

async function loadAllMintedNFTs() {
  // Example: if stored in a JSON file or database
  const fs = require('fs').promises;
  const raw = await fs.readFile('./minted_nfts.json', 'utf-8');
  return JSON.parse(raw);
}

async function getMetadataFromIPFS(cid) {
  const axios = require('axios');
  const response = await axios.get(`https://ipfs.io/ipfs/${cid}`);
  return response.data;
}

async function getNFTokenOwner(tokenId) {
  const xrpl = require('xrpl');
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  const nftData = await client.request({
    command: "nft_info",
    nft_id: tokenId
  });

  const owner = nftData.result?.nft_info?.owner;
  await client.disconnect();
  return owner;
}

async function getMintedNFTsFromBlockchain() {
  // Query the blockchain (XRPL or other) to get a list of minted NFTs
  // This can include getting the token_id, owner, and other basic NFT info.
  
  // Example of getting NFTs from XRPL (you will need the XRPL SDK to do this)
  // For example, this is a placeholder and needs to be replaced with actual logic
  const nftData = await xrplClient.request({
    method: 'account_nfts',
    params: {
      account: 'rEXAMPLEOWNER', // Replace with dynamic wallet addresses as needed
    }
  });

  return nftData.result.nfts; // This returns the list of minted NFTs
}

async function getMetadataFromStorage(token_id) {
  try {
    // This assumes the metadata is stored on IPFS or NFT.Storage
    const metadataUrl = `https://ipfs.io/ipfs/${token_id}`; // Replace this with the actual IPFS URL or NFT.Storage
    
    const response = await fetch(metadataUrl);
    const metadata = await response.json();

    return metadata;
  } catch (error) {
    console.error("Error fetching metadata for token_id:", token_id, error);
    return {};
  }
}




export async function getCurrentOwner(nftId) {
  const client = new xrpl.Client('wss://xrplcluster.com'); // XRPL mainnet WebSocket
  await client.connect();

  try {
    const response = await client.request({
      command: 'nft_info',
      nft_id: nftId
    });

    return response.result?.nft_object?.owner || null;
  } catch (err) {
    console.error('Error fetching NFT info:', err?.data ?? err);
    return null;
  } finally {
    await client.disconnect();
  }
}

let mintedNFTs = [];

app.get('/catalog', async (req, res) => {
  try {
    const client = new xrpl.Client('wss://xrplcluster.com'); // XRPL Mainnet
    await client.connect();

    const catalog = await Promise.all(
      mintedNFTs.map(async (nft) => {
        try {
          const nftInfo = await client.request({
            command: 'nft_info',
            nft_id: nft.nft_id
          });

          return {
            token_id: nft.nft_id,
            owner: nftInfo.result.nft_object.owner,
            metadata_url: nft.metadata_url
          };
        } catch (err) {
          return {
            token_id: nft.nft_id,
            error: 'Failed to fetch NFT info'
          };
        }
      })
    );

    await client.disconnect();
    res.json({ success: true, catalog });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// Route to get all available NFT sale offers
app.get('/nfts', async (req, res) => {
  try {
    await client.connect();

    // Search for NFTokenOffers, which represent NFTs available for sale
    const response = await client.request({
      command: 'search',
      query: {
        ledger_entry_type: 'NFTokenOffer',
        filters: []
      }
    });

    const nftOffers = response.result?.ledger || [];
    const nftData = nftOffers.map(nft => ({
      token_id: nft.NFTokenID,
      price: nft.Amount?.value, // Amount the NFT is listed for
      issuer: nft.Issuer,
      owner: nft.Account,
      metadata_url: nft.URI, // Optional metadata link (if available)
    }));

    res.json({ success: true, nfts: nftData });
  } catch (err) {
    console.error('Error fetching NFTs:', err);
    res.status(500).json({ success: false, error: 'Error fetching NFTs' });
  } finally {
    await client.disconnect();
  }
});

async function loadActiveOffers(wallet) {
  const container = document.getElementById('active-offers');
  container.innerHTML = '<h3>Active Offers</h3>';

  try {
    const res = await fetch(`https://seagullcoin-dex-uaj3x.ondigitalocean.app/active-offers/${wallet}`);
    const { sellOffers, buyOffers } = await res.json();

    sellOffers.forEach(offer => {
      const bar = document.createElement('div');
      bar.style.margin = "4px 0";
      bar.innerHTML = `
        <span>( amount ${offer.amount} SGLCN )</span>
        <button onclick="cancelOffer('${offer.offerId}')">Cancel Sell</button>
      `;
      container.appendChild(bar);
    });

    buyOffers.forEach(offer => {
      const bar = document.createElement('div');
      bar.style.margin = "4px 0";
      bar.innerHTML = `
        <span>( offer ${offer.amount} SGLCN )</span>
        <button onclick="cancelOffer('${offer.offerId}')">Cancel Buy</button>
      `;
      container.appendChild(bar);
    });

  } catch (err) {
    console.error("Error loading active offers:", err);
  }
}

async function cancelOffer(offerId) {
  const confirmCancel = confirm("Cancel this offer?");
  if (!confirmCancel) return;

  const res = await fetch("https://seagullcoin-dex-uaj3x.ondigitalocean.app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offerId,
      walletAddress: localStorage.getItem("xumm_wallet_address")
    })
  });
  
  const data = await res.json();
  if (data?.next?.always) {
    window.open(data.next.always, "_blank");
  } else {
    alert("Failed to cancel offer.");
  }
}

const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const SEAGULLCOIN_HEX = "53656167756C6C436F696E000000000000000000";

async function hasSeagullCoinTrustline(walletAddress) {
  try {
    const result = await axios.get(`https://xumm.app/api/v1/platform/user-account-lines/${walletAddress}`, {
      headers: {
        'X-API-Key': process.env.XUMM_API_KEY
      }
    });

    const lines = result.data.lines;

    return lines.some(line =>
      (line.currency === 'SeagullCoin' || line.currency === '53656167756C6C436F696E000000000000000000') &&
      line.account === SEAGULLCOIN_ISSUER
    );
  } catch (error) {
    console.error('XUMM trustline check failed:', error.response?.data || error.message);
    return false;
  }
}

// Function to fetch offers from XRPL for a given wallet address
async function fetchOffersFromXRPL(walletAddress) {
  try {
    // Replace with the XRPL endpoint you are using
    const xrplEndpoint = `https://s1.ripple.com:51234`; // Default public XRPL server
    const data = {
      "method": "account_offers",
      "params": [{
        "account": walletAddress
      }]
    };

    // Make the request to the XRPL server
    const response = await axios.post(xrplEndpoint, data);

    // Check if the response contains offers
    if (response.data && response.data.result && response.data.result.offers) {
      // Filter out only SeagullCoin offers
      const filteredOffers = response.data.result.offers.filter(offer => 
        offer.amount.currency === SEAGULLCOIN_HEX &&
        offer.amount.issuer === SEAGULL_COIN_ISSUER
      );
      
      return { offers: filteredOffers };  // Return the filtered offers
    } else {
      return { offers: [] };  // Return empty offers if none are found
    }
  } catch (error) {
    console.error('Error fetching offers from XRPL:', error);
    throw new Error('Failed to fetch offers from XRPL');
  }
}


app.get('/offers/:wallet', async (req, res) => {
  const wallet = req.params.wallet;
  const client = new xrpl.Client(xrplApiUrl);
  await client.connect();

  try {
    const accountObjects = await client.request({
      command: "account_objects",
      account: wallet,
      type: "nf_token_offer"
    });

    const offers = accountObjects.result.account_objects || [];

    const sellOffers = offers.filter(o => o.Flags & xrpl.NFTokenOfferFlags.tfSellNFToken);
    const buyOffers = offers.filter(o => !(o.Flags & xrpl.NFTokenOfferFlags.tfSellNFToken));

    res.json({
      success: true,
      sellOffers: sellOffers.map(o => ({
        id: o.index,
        amount: (parseFloat(o.Amount.value) / 1000000).toFixed(2),
        tokenId: o.NFTokenID
      })),
      buyOffers: buyOffers.map(o => ({
        id: o.index,
        amount: (parseFloat(o.Amount.value) / 10000000).toFixed(2),
        tokenId: o.NFTokenID
      }))
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  } finally {
    client.disconnect();
  }
});

app.post('/nft-offers', async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ success: false, message: 'Missing wallet address' });
  }

  try {
    const client = new xrpl.Client("wss://xrplcluster.com");
    await client.connect();

    // Fetch all account objects
    const response = await client.request({
      command: "account_objects",
      account: walletAddress,
      ledger_index: "validated"
    });

    // Log the entire response to see the data
    console.log("XRPL Account Objects Response:", response);

    const offers = response.result.account_objects || [];

    // Log the offers to check for incoming and outgoing
    console.log("Account Offers:", offers);

    // Filter offers for incoming and outgoing NFT offers
    const incoming = offers.filter(o => o.Destination === walletAddress && o.Type === "NFTokenOffer");
    const outgoing = offers.filter(o => o.Account === walletAddress && o.Type === "NFTokenOffer");

    await client.disconnect();

    return res.json({
      success: true,
      incoming,
      outgoing
    });

  } catch (err) {
    console.error("Offer fetch error:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
});


app.get('/verify-trustline/:wallet', async (req, res) => {
  const wallet = req.params.wallet;

  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  try {
    const accountLines = await client.request({
      command: "account_lines",
      account: wallet,
    });

    const hasTrustline = accountLines.result.lines.some(
      line =>
        line.currency === "53656167756C6C43617368000000000000000000" &&
        line.account === "rNHeGnj4kqGSVyFzDcoyi3gsp1bdPuGeNK"
    );

    await client.disconnect();
    return res.json({ hasTrustline });

  } catch (err) {
    await client.disconnect();
    return res.status(500).json({ error: "Failed to verify trustline", details: err.message });
  }
});

app.post('/create-sell-offer', async (req, res) => {
  const { wallet, tokenId, amount } = req.body;
  if (!wallet || !tokenId || !amount) {
    return res.status(400).json({ error: 'Missing wallet, tokenId, or amount' });
  }

  try {
    const payload = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet,
      NFTokenID: tokenId,
      Amount: {
        currency: '53656167756C6C43617368000000000000000000', // SeagullCoin (hex)
        issuer: 'rNHeGnj4kqGSVyFzDcoyi3gsp1bdPuGeNK',         // Issuer
        value: amount.toString()                               // Price in SeagullCoin
      },
      Flags: 1
    };

    // Create and push the offer payload with XUMM
    const sellOffer = await xumm.payload.createAndSubscribe(
      {
        txjson: payload,
        options: { submit: true }, // Submit the transaction immediately to get the signing link
      },
      event => {
        return event.data.signed === true; // Check if the user signed the payload
      }
    );

    // Check if the payload was signed or not
    if (sellOffer?.next?.always) {
      res.json({ 
        success: true, 
        uuid: sellOffer.uuid, 
        next: sellOffer.next.always // The URL to sign the transaction
      });
    } else {
      res.status(400).json({ error: 'User declined the offer.' });
    }
  } catch (err) {
    console.error('Sell offer error:', err?.data || err);
    res.status(500).json({ error: 'Sell offer creation failed.' });
  }
});



app.post('/burn-nft', async (req, res) => {
  const { walletAddress, nftId } = req.body;

  const payload = {
    TransactionType: "NFTokenBurn",
    Account: walletAddress,
    NFTokenID: nftId
  };

  const { created } = await xumm.payload.createAndSubscribe(payload, e => {
    return e.data.signed === true;
  });

  res.json({ success: true, next: created.next });
});

const SERVICE_WALLET_SEED = process.env.SERVICE_WALLET_SEED;
const SERVICE_WALLET_ADDRESS = process.env.SERVICE_WALLET_ADDRESS;

app.post('/pays', async (req, res) => {
  const { wallet } = req.body;

  const payload = {
    txjson: {
      TransactionType: "Payment",
      Destination: SERVICE_WALLET_ADDRESS,
      Amount: {
        currency: "53656167756C6C4D616E73696F6E730000000000",
        issuer: "rU3y41mnPFxRhVLxdsCRDGbE2LAkVPEbLV",
        value: "0.18"
      }
    },
    options: {
      submit: true,
      expire: 300
    }
  };

  const response = await xumm.payload.create(payload);
  res.json({
    uuid: response.uuid,
    next: response.next.always
  });
});

function extractNFTokenID(txResult) {
  const affected = txResult.meta?.AffectedNodes || [];
  for (const node of affected) {
    const created = node.CreatedNode;
    if (created && created.LedgerEntryType === "NFTokenPage") {
      const nfts = created.NewFields?.NFTokens;
      if (nfts && nfts.length > 0) {
        return nfts[0].NFToken.NFTokenID;
      }
    }
  }
  return null;
}

app.post('/mint-after-payment', async (req, res) => {
  const { paymentUUID } = req.body;
  if (!paymentUUID) return res.status(400).json({ error: "Missing paymentUUID" });

  let paymentPayload;
  try {
    paymentPayload = await xumm.payload.get(paymentUUID);
    if (!paymentPayload?.meta?.exists) {
      return res.status(400).json({ error: "Payment payload not found" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Failed to retrieve payment payload" });
  }

  const txnHex = paymentPayload.response?.hex;
  const userAddress = paymentPayload.response?.account;

  if (!txnHex) return res.status(400).json({ error: "Transaction not submitted yet." });
  if (!userAddress || userAddress.length !== 34) {
    return res.status(400).json({ error: "Invalid wallet address in signed payload" });
  }

  let txn;
  try {
    txn = xrpl.decode(txnHex);
  } catch (e) {
    return res.status(500).json({ error: "Failed to decode transaction" });
  }

  const validPayment = (
    txn.TransactionType === "Payment" &&
    typeof txn.Amount === "object" &&
    (
      txn.Amount.currency === "53656167756C6C4D616E73696F6E730000000000" || // Hex for "SeagullCoin"
      txn.Amount.currency === "SGLMSN" // Short alias if used
    ) &&
    txn.Amount.issuer === SERVICE_WALLET_ADDRESS.trim() &&
    parseFloat(txn.Amount.value) >= 0.18
  );

  if (!validPayment) {
    return res.status(400).json({ error: "Invalid or insufficient payment" });
  }

  const availableNFT = nftokens.find(n => !usedNFTs.has(n.id) && !pendingNFTs.has(n.id))
  if (!availableNFT) return res.status(503).json({ error: "No NFTs available" });

  pendingNFTs.add(availableNFT.id);

  try {
    const offerPayload = {
  txjson: {
    TransactionType: "NFTokenCreateOffer",
    Account: SERVICE_WALLET_ADDRESS,  // MUST be service wallet (the current NFT owner)
    NFTokenID: availableNFT.id, // CORRECT
    Destination: userAddress,        // buyer wallet
    Amount: "0",
    Flags: xrpl.NFTokenCreateOfferFlags.tfSellNFToken
  },
  options: {
    submit: true,
    expire: 600
  }
};


    const payload = await xumm.payload.create(offerPayload);
    console.log('Offer Payload:', JSON.stringify(payload, null, 2));

    
    return res.json({
  success: true,
  message: "NFT payment verified. Sign offer via XUMM.",
  nftoken_id: availableNFT.id,
  offer_payload_uuid: payload.uuid,
  xumm_sign_url: payload.next.always,
  metadata: await fetchIPFSMetadata(availableNFT.metadata_uri || "")

})


  } catch (err) {
    console.error("XUMM signing error:", err.message);
    pendingNFTs.delete(availableNFT.id); // CORRECT
    return res.status(500).json({ error: "Failed to prepare NFT offer", details: err.message });
  }
});

app.post('/accept-offer', async (req, res) => {
  const { offerPayloadUUID } = req.body;
  if (!offerPayloadUUID) return res.status(400).json({ error: "Missing offerPayloadUUID" });

  try {
    const offerStatus = await xumm.payload.get(offerPayloadUUID);
    const offerTxid = offerStatus.response?.txid;

    if (!offerTxid) return res.status(400).json({ error: "Offer not signed yet or missing txid." });

    const client = new xrpl.Client("wss://xrplcluster.com");
    await client.connect();
    const tx = await client.request({
      command: "tx",
      transaction: offerTxid
    });
    await client.disconnect();

    const offerIndex = tx.result?.meta?.AffectedNodes?.find(n =>
      n.CreatedNode?.LedgerEntryType === "NFTokenOffer"
    )?.CreatedNode?.LedgerIndex;

    if (!offerIndex) return res.status(400).json({ error: "Offer index not found on-chain." });

    const acceptPayload = {
      txjson: {
        TransactionType: "NFTokenAcceptOffer",
        NFTokenSellOffer: offerIndex
      },
      options: {
        submit: true,
        expire: 600
      }
    };

    const acceptPayloadResult = await xumm.payload.create(acceptPayload);
    console.log("Accept Payload:", acceptPayloadResult.uuid);

    return res.json({
      success: true,
      accept_payload_uuid: acceptPayloadResult.uuid,
      xumm_sign_url: acceptPayloadResult.next.always
    });

  } catch (err) {
    console.error("Error preparing accept-offer:", err.message);
    return res.status(500).json({ error: "Failed to prepare accept-offer", details: err.message });
  }
});


app.get('/payload-status/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const result = await xumm.payload.get(uuid);

    if (result.meta?.resolved === false) {
      return res.json({ status: "pending" });
    }

    if (result.meta?.signed === true) {
      console.log("Payload signed:", result.response.txid);
      return res.json({ status: "signed", txid: result.response.txid });
    } else {
      return res.json({ status: "rejected" });
    }
  } catch (err) {
    console.error("Error checking payload status:", err);
    res.status(500).json({ error: "Could not check payload status" });
  }
});



app.post('/mint-complete', async (req, res) => {
  const { offerPayloadUUID, acceptPayloadUUID } = req.body;

  if (!offerPayloadUUID && !acceptPayloadUUID) {
    return res.status(400).json({ error: "Missing offerPayloadUUID or acceptPayloadUUID" });
  }

  try {
    const payloadUUID = acceptPayloadUUID || offerPayloadUUID;
    const offerStatus = await xumm.payload.get(payloadUUID);

    if (!offerStatus.meta.signed) {
      return res.status(400).json({ error: "Offer not signed yet" });
    }

    const txid = offerStatus.response.txid;

    if (!txid) {
      return res.status(400).json({ error: "Transaction was signed but txid missing" });
    }

    const txResult = await client.request({
      command: "tx",
      transaction: txid
    });

    const tx = txResult.result;
    const nftID = tx?.NFTokenID || tx?.meta?.AffectedNodes?.find(n =>
      n.ModifiedNode?.LedgerEntryType === "NFTokenOffer"
    )?.ModifiedNode?.FinalFields?.NFTokenID;

    if (!nftID) {
      return res.status(400).json({ error: "Could not extract NFTokenID from transaction" });
    }

    // Final cleanup
    usedNFTs.add(nftID);
    pendingNFTs.delete(nftID);
    nftokens = nftokens.filter(id => id !== nftID);

    return res.json({
      success: true,
      message: "NFT successfully transferred.",
      txid,
      nftoken_id: nftID
    });

  } catch (err) {
    console.error("mint-complete error:", err);
    return res.status(500).json({ error: "Failed to finalize NFT minting", details: err.message });
  }
});





const usedNFTs = new Set(
'00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7B7ABA7F30405C658',
  
'00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7CE9178F40405C659',
);

const pendingNFTs = new Set();

const nftokens = [
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7D9173B160405C67B',
    uri: 'ipfs://bafkreighidrswa32ab2ypiftovyz44ejo57lrvjdnhwzxgbohvirfqmmzi'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7A30B8F2A0405C68F',
    uri: 'ipfs://bafkreif5sxsrinlnjzjeotbgo2od5jbhazcznds4ftuwhgrztubfi2vliu'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7795FF21D0405C682',
    uri: 'ipfs://bafkreihzhxpim7epgwy4zmwbhgltamazoomuihysd44eeertpqbbgyjeee'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7753FED280405C68D',
    uri: 'ipfs://bafkreien3knint645qowkbgm4xft7tobic3zscoansynmhculrnfta2ts4'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C75E5A1C270405C68C',
    uri: 'ipfs://bafkreihqan6coq5arhrwmr4gsjzrcm3fwuslzi22n5b7ssykxt2xzd2aau'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7308E7A250405C68A',
    uri: 'ipfs://bafkreifwlrss42fyl3natbzg3krxqvqwy5vdpzfxjwuvmchwfbunimdzaa'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C719A8A9240405C689',
    uri: 'ipfs://bafkreifretxidbinkg4iy7ftevamg4uj4vn7zacbotw7k2abijnjdg6cm4'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C702C2D8230405C688',
    uri: 'ipfs://bafkreicynplfiek7ai4z6s5sv2s5ev7mg2zww3cuaq6scky2hvqatr5xri'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7EBDD07220405C687',
    uri: 'ipfs://bafkreic2wvss5fwxnjamat4yymlbto44goemcwtk6tzfvow4k3cot2lh6e'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7A72B941F0405C684',
    uri: 'ipfs://bafkreie4uj5mo6gxfnxc3d3hqxqjkec2z77n4rlip2dgefmyvyooobwlxy'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C78C25BE290405C68E',
    uri: 'ipfs://bafkreigybtrp4q2tixs7745k2m3n5wfwajyqpoqon7mxqqoh2v65gxjgwq'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C79045C31E0405C683',
    uri: 'ipfs://bafkreie5qnbfge674smazi3z5cskohio25f6kr5wfagkiyqwpmyb7lmrrq'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7627A211C0405C681',
    uri: 'ipfs://bafkreicdat4wmq7gxbzphpqgyip6hn3mijsahfcy4xjlphymzdnrddezu4'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C74B94501B0405C680',
    uri: 'ipfs://bafkreibl53h6iclcfa62mlninvaor5e4eonvzg4f42k32ah26igzw7zsmy'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7E57749F50405C65A',
    uri: 'ipfs://bafkreigb7tedzlf6zn7mnny67ynpj5isnhrfzvng7v74tizvsyhyou45qy'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7FC5D1AF60405C65B',
    uri: 'ipfs://bafkreiadriiyblagdag6gzsdkh74n2afltrlgrwwwyew737gytndu2dce4'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C71342EBF70405C65C',
    uri: 'ipfs://bafkreifmjafrtwsfdjlm6mwun4mvv2ynyqtn3inhspmypdcs3p6lqewfre'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C72A28BCF80405C65D',
    uri: 'ipfs://bafkreibpvonnipl2p4e3k3zqcaom4qkqj7rbux346ieehgnuaowkkrcugq'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7BE1165200405C685',
    uri: 'ipfs://bafkreidcz24r54gwjndw45ykhozfjkrxgj3zkos776ixvdoxfkbvx4riei'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7410E8DF90405C65E',
    uri: 'ipfs://bafkreiembddxdaxpsg27l7py5f4fixnlat7bfo75piarmgisczf7nzalxi'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C785C000FC0405C661',
    uri: 'ipfs://bafkreiadth3yqngddj7o33dxtgbdte5xvxvvwppglv2qzckioqblx7kioa'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C79CA5D1FD0405C662',
    uri: 'ipfs://bafkreiakhng6tg5jm73s7tmw7jwrqcskyvdyh22i3mi2ngvef673kzv4bi'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7B38BA2FE0405C663',
    uri: 'ipfs://bafkreihptxl7nhcfldugiw2mnauw5k2boykw3qkwosn5sb7nwohm2yfovy'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7F83D16010405C666',
    uri: 'ipfs://bafkreieqahikodn5evlxn6jkilyg77j767spv4ixati6vjge2vaclnsj3y'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C70F22E7020405C667',
    uri: 'ipfs://bafkreiayqz7b5xsoqmuivmtre4raqarrjp5ltajoccvxc35eh6fn2me3gi'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C72608B8030405C668',
    uri: 'ipfs://bafkreic22m6r3dn7lz5vh5maudbcyvjvs3pbsinupdaa37vb5pqc2e4vzy'
  },
  {
  id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C73CEE89040405C669',
    uri: 'ipfs://bafkreifrztkfhwp4s7l77qplecrypguruube5vnodzdble26y7e7ajwt5u'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C753D45A050405C66A',
    uri: 'ipfs://bafkreia3tuxsv35kiffli5lmz4ygd4leepp2b56mndkqk7q5qk3c6fj3xi'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C76ABA2B060405C66B',
    uri: 'ipfs://bafkreigc2cffoohlyqmllhgzqkhshihmtcum5wbgr5kgauihosjt7vdq3y'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C734AE7F1A0405C67F',
    uri: 'ipfs://bafkreib5s2qb4cdarybay3yvp4blfn7cqhl4vbg7whctrqsaihzpbucptq'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7819FFC070405C66C',
    uri: 'ipfs://bafkreigekg6oihozyjakch6mps2mlqx64ntmsklf6jyk7kywpdqvjg63iu'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7E15745000405C665',
    uri: 'ipfs://bafkreicsswemlcttmkwf26i53nnv6dkemi66t2bbnk2y3wtsftzpdfoxkm'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C79885CD080405C66D',
    uri: 'ipfs://bafkreif226vajeccicfrzgqyck3kay3kzqhosftrosehdifvhpdtkhtk2a'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7DD37400B0405C670',
    uri: 'ipfs://bafkreicnsaujzm7u5rxguhayvl6pwz7toxiwmj2rdctm7uolpxqk6uadde'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7F41D110C0405C671',
    uri: 'ipfs://bafkreidhrfpkci3xwvb7sj3656n7a4dbncp7nbecllpan62bo3cs3n4dwa'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C70B02E20D0405C672',
    uri: 'ipfs://bafkreihtngvjrd32xrqodgsjq7lkxcjleu7lzz5wwepyfk5sssgxpjexbm'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C721E8B30E0405C673',
    uri: 'ipfs://bafkreigrm6inghxgjjck7slb4eozvluodsmhazhavj2cagn6w5laohs3o4'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C738CE840F0405C674',
    uri: 'ipfs://bafkreibrqm2udtrtdcxwoyo2efi6xexpm3fg5wx7j3mpaqx2ytcmig6fmi'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C74FB455100405C675',
    uri: 'ipfs://bafkreievxpfykt3vtezpzbw7e36eqjxzwjmjchtkbhkymwdf4q66zmg4sa'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C77D7FF7120405C677',
    uri: 'ipfs://bafkreih34nxjaibebrhxp55j2kj7ihhqlk2svjtiiebympraglu3ssu4zq'
  }, 
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C79465C8130405C678',
    uri: 'ipfs://bafkreick5uf4zj347w65766gzjl637aogdzodly6tdn5tefkbd2t44to4e'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7AB4B99140405C679',
    uri: 'ipfs://bafkreielescqjf55cg73gh52ybf3wgvaemkfvb6ooz2lruvw4k6yqwbsum'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7C2316A150405C67A',
    uri: 'ipfs://bafkreif2rixswyxczlpvirwo4yp7d3hbig3752audiocuymtzwcxntaovm'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C7669A26110405C676',
    uri: 'ipfs://bafkreihjyncjzsnoiu6bh6rqo2snkro22tzp4sj75acvvb6ywmvvcjxcni'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C706E2DD180405C67D',
    uri: 'ipfs://bafkreiegdbmvssoxkjcf2ald74njrhr6hjz5i2vtx373wqxre2fo6df44q'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C71DC8AE190405C67E',
    uri: 'ipfs://bafkreibiylgpnl3jznray5bhafpp42tyokyoq2vmelho5z7qogylq7xyoq'
  },
  {
    id: '00081F40FC69103C8AEBE206163BC88C42EA2ED6CEF190C76EDA2FFB0405C660',
    uri: 'ipfs://bafkreihlsbeabv54ehdqmwes6mpr6ipg7l4x2rfkyiz6g65xfefjmoxrke'
  }
];

// Load used NFTs
db.all("SELECT nft_token_id FROM minted_nfts WHERE status = 'minted'", [], (err, rows) => {
  if (err) throw err;
  rows.forEach(row => usedNFTs.add(row.nft_token_id));
});

// Load pending NFTs
db.all("SELECT nft_token_id FROM minted_nfts WHERE status = 'pending'", [], (err, rows) => {
  if (err) throw err;
  rows.forEach(row => pendingNFTs.add(row.nft_token_id));
});

// Get next available NFT
function getNextAvailableNFT() {
  for (const nft of nftokens) {
    if (!usedNFTs.has(nft) && !pendingNFTs.has(nft)) {
      pendingNFTs.add(nft); // Temporarily lock it
      return nft;
    }
  }
  return null;
}

// Transfer NFT using XUMM payload
async function transferNFT(userAddress, destination, nftTokenID) {
  try {
    const payload = {
      txjson: {
        TransactionType: 'NFTokenCreateOffer',
        Account: userAddress,
        NFTokenID: nftTokenID,
        Amount: '0',
        Destination: destination,
        Flags: 1 // Sell offer, Amount=0 = gift
      }
    };

    const { created, resolved } = await xumm.payload.createAndSubscribe(payload, event => {
      return event.data.signed === true || event.data.signed === false;
    });

    if (!created || !created.uuid) {
      console.error("Payload creation failed");
      return null;
    }
    
    if (resolved.signed) {
      console.log("NFT offer signed.");
      return { success: true, nftTokenID, uuid: created.uuid };
    } else {
      console.log("User declined the offer.");
      pendingNFTs.delete(nftTokenID); // Free up token if rejected
      return { success: false };
    }
  } catch (e) {
    console.error("Error creating NFT offer via XUMM:", e);
    return null;
  }
}

// SeagullMansions token setup
const REQUIRED_PAYMENT_AMOUNT = 0.18;
const SEAGULLMANSIONS_ISSUER = 'rU3y41mnPFxRhVLxdsCRDGbE2LAkVPEbLV';
const SEAGULLMANSIONS_CURRENCY = 'SeagullMansions'; // Must match XRPL trustline format
const TOKEN_ISSUER = 'rHr4mUQjRusoNNYnzCp5BFumyWjycgVHJS';
const TOKEN_HEX = '53656167756C6C4D616E73696F6E730000000000';
const REQUIRED_AMOUNT = '0.18';
const sERVICE_WALLET = "rU3y41mnPFxRhVLxdsCRDGbE2LAkVPEbLV";



//Trustline details
const CURRENCY_HEX = '53656167756C6C4D616E73696F6E730000000000';
const ISSUER = 'rU3y41mnPFxRhVLxdsCRDGbE2LAkVPEbLV';

app.get('/check-payment', async (req, res) => {
  const { uuid } = req.query;
  try {
    const status = await xumm.payload.get(uuid);
    const txid = status?.response?.txid;

    if (status?.meta?.resolved && status.meta.signed && txid) {
      res.json({ confirmed: true, txid });
    } else {
      res.json({ confirmed: false });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to check payment' });
  }
});




// Endpoint to mint and send NFTs
// 1. Create payment payload endpoint
//POST /create-trustline
app.post('/create-trustline', async (req, res) => {
  const { userAddress } = req.body;
  if (!userAddress) return res.status(400).json({ error: 'Missing user address' });

  const txJson = {
    TransactionType: 'TrustSet',
    Account: userAddress,
    LimitAmount: {
      currency: CURRENCY_HEX,
      issuer: ISSUER,
      value: '9'
    }
  };

  try {
    const payload = await xumm.payload.create({
      txjson: txJson,
      options: {
        submit: true,
        expire: 300
      }
    });

    res.json({
      message: 'Sign the trustline in XUMM',
      payload_uuid: payload.uuid,
      payload_url: payload.next.always
    });
  } catch (e) {
    console.error('Error creating trustline payload:', e?.message || e);
    res.status(500).json({ error: 'Failed to create trustline payload' });
  }
});

// Issuer wallet and token details
const ISSUER_ACCOUNT = 'rU3y41mnPFxRhVLxdsCRDGbE2LAkVPEbLV';
const TOKEN_CURRENCY = '53656167756C6C4D616E73696F6E730000000000'; // SeagullMansions hex

app.post('/issue-tokens', async (req, res) => {
  const { destination, amount } = req.body;

  if (!destination || !amount) {
    return res.status(400).json({ error: 'Destination address and amount are required' });
  }

  try {
    const tx = {
      TransactionType: 'Payment',
      Account: ISSUER_ACCOUNT,
      Destination: destination,
      Amount: {
        currency: TOKEN_CURRENCY,
        issuer: ISSUER_ACCOUNT,
        value: amount.toString(),
      },
    };

    const payload = await xumm.payload.create({
      txjson: tx,
      options: {
        submit: true,
        expire: 300, // expires in 5 minutes
      },
    });

    res.json({
      message: 'Sign the issuance in XUMM',
      payload_uuid: payload.uuid,
      payload_url: payload.next.always,
    });
  } catch (error) {
    console.error('Failed to create issuance payload:', error);
    res.status(500).json({ error: 'Failed to create issuance payload' });
  }
});

app.post("/backup-pay", async (req, res) => {
  const { destination } = req.body;

  // Validate address
  if (!destination || typeof destination !== "string") {
    return res.status(400).json({ error: "Destination address is required." });
  }

  // Basic XRPL address validation
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(destination)) {
    return res.status(400).json({ error: "Invalid XRPL address." });
  }

  try {
    const payload = {
  txjson: {
    TransactionType: "Payment",
    Destination: destination,
    Amount: {
      currency: "53656167756C6C436F696E000000000000000000", // SeagullCoin
      issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno",
      value: "50501"
    },
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from("Staking Rewards", "utf8").toString("hex"),
          MemoData: Buffer.from("Monthly", "utf8").toString("hex")
        }
      }
    ]
  },
  options: {
    submit: true,
    expire: 300,
    return_url: {
      app: "https://yourdomain.com/thank-you",
      web: "https://yourdomain.com/thank-you"
    }
  }
};
    
    const created = await xumm.payload.create(payload);

    res.json({
      uuid: created.uuid,
      next: created.next.always
    });

  } catch (err) {
    console.error("XUMM Payload Error:", err?.message || err);
    res.status(500).json({ error: "Failed to create backup payment." });
  }
});

app.get('/stake-payload-two/:walletAddress', async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const amount = '2500000'; // Fixed amount
    const tier = '1 Year';
    const lockupDays = 365 * 1;
    const now = new Date();

    if (!walletAddress || !walletAddress.startsWith('r')) {
      return res.status(400).json({ error: 'Invalid or missing wallet address' });
    }

    const db = await connectDB();
    const stakesCollection = db.collection('stakes');

    const payloadResponse = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U', // Your staking service wallet
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000', // Hex for "SeagullCoin"
          issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
          value: '2500000'
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('1Year', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(walletAddress, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      options: {
        submit: true,
        expire: 10
      }
    });

    if (!payloadResponse?.uuid) {
      throw new Error('XUMM payload creation failed - no UUID');
    }

    const stakeData = {
      walletAddress,
      amount: Number(amount),
      timestamp: now,
      stakeEndDate: new Date(now.getTime() + lockupDays * 24 * 60 * 60 * 1000),
      xummPayloadUUID: payloadResponse.uuid,
      tier,
      status: 'pending'
    };

    await stakesCollection.insertOne(stakeData);

    // ✅ Wait 2 seconds and fetch status (or use a longer delay + client-side polling for UX)
    setTimeout(async () => {
      try {
        const payloadDetails = await xumm.payload.get(payloadResponse.uuid);
        const wasSigned = payloadDetails?.meta?.resolved && payloadDetails?.meta?.signed;

        if (wasSigned) {
          await stakesCollection.updateOne(
            { xummPayloadUUID: payloadResponse.uuid },
            { $set: { status: 'confirmed' } }
          );
          console.log(`✅ Payload ${payloadResponse.uuid} signed and confirmed.`);
        } else {
          console.log(`🕓 Payload ${payloadResponse.uuid} still pending or was rejected.`);
        }
      } catch (pollErr) {
        console.error('❌ Failed to check XUMM payload status:', pollErr.message);
      }
    }, 2000);
    
    return res.json(payloadResponse);

  } catch (error) {
    console.error('❌ Error creating XUMM stake payload:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message
    });

    return res.status(500).json({
      error: 'Failed to create stake payload',
      details: error?.response?.data?.message || error.message
    });
  }
});



    app.post("/backup-pay-two", async (req, res) => {
  const { destination } = req.body;

  // Validate address
  if (!destination || typeof destination !== "string") {
    return res.status(400).json({ error: "Destination address is required." });
  }

  // Basic XRPL address validation
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(destination)) {
    return res.status(400).json({ error: "Invalid XRPL address." });
  }

  try {
    const payload = {
  txjson: {
    TransactionType: "Payment",
    Destination: destination,
    Amount: {
      currency: "53656167756C6C436F696E000000000000000000", // SeagullCoin
      issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno",
      value: "2562500"
    },
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from("Staking Rewards", "utf8").toString("hex"),
          MemoData: Buffer.from("Yearly", "utf8").toString("hex")
        }
      }
    ]
  },
  options: {
    submit: true,
    expire: 300,
    return_url: {
      app: "https://seagullcoin-dex-uaj3x.ondigitalocean.app",
      web: "https://seagullcoin-dex-uaj3x.ondigitalocean.app"
    }
  }
};


    const created = await xumm.payload.create(payload);

    res.json({
      uuid: created.uuid,
      next: created.next.always
    });

  } catch (err) {
    console.error("XUMM Payload Error:", err?.message || err);
    res.status(500).json({ error: "Failed to create backup payment." });
  }
});


app.post("/backup-pay-three", async (req, res) => {
  const { destination } = req.body;

  // Validate address
  if (!destination || typeof destination !== "string") {
    return res.status(400).json({ error: "Destination address is required." });
  }

  // Basic XRPL address validation
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(destination)) {
    return res.status(400).json({ error: "Invalid XRPL address." });
  }

  try {
    const payload = {
  txjson: {
    TransactionType: "Payment",
    Destination: destination,
    Amount: {
      currency: "53656167756C6C436F696E000000000000000000", // SeagullCoin
      issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno",
      value: "6000000"
    },
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from("Staking Rewards", "utf8").toString("hex"),
          MemoData: Buffer.from("5 year", "utf8").toString("hex")
        }
      }
    ]
  },
  options: {
    submit: true,
    expire: 300,
    return_url: {
      app: "https://seagullcoin-dex-uaj3x.ondigitalocean.app",
      web: "https://seagullcoin-dex-uaj3x.ondigitalocean.app"
    }
  }
};


    const created = await xumm.payload.create(payload);

    res.json({
      uuid: created.uuid,
      next: created.next.always
    });

  } catch (err) {
    console.error("XUMM Payload Error:", err?.message || err);
    res.status(500).json({ error: "Failed to create backup payment." });
  }
});


app.get('/stake-payload-three/:walletAddress', async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const amount = '5000000'; // Fixed amount
    const tier = '5 Year';
    const lockupDays = 365 * 5;
    const now = new Date();
    
    if (!walletAddress || !walletAddress.startsWith('r')) {
      return res.status(400).json({ error: 'Invalid or missing wallet address' });
    }

    const db = await connectDB();
    const stakesCollection = db.collection('stakes');

    const payloadResponse = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U', // Your staking service wallet
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000', // Hex for "SeagullCoin"
          issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
          value: '5000000'
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('5Years', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(walletAddress, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      options: {
        submit: true,
        expire: 10
      }
    });

    if (!payloadResponse?.uuid) {
      throw new Error('XUMM payload creation failed - no UUID');
    }

    const stakeData = {
      walletAddress,
      amount: Number(amount),
      timestamp: now,
      stakeEndDate: new Date(now.getTime() + lockupDays * 24 * 60 * 60 * 1000),
      xummPayloadUUID: payloadResponse.uuid,
      tier,
      status: 'pending'
    };


    await stakesCollection.insertOne(stakeData);

    // ✅ Wait 2 seconds and fetch status (or use a longer delay + client-side polling for UX)
    setTimeout(async () => {
      try {
        const payloadDetails = await xumm.payload.get(payloadResponse.uuid);
        const wasSigned = payloadDetails?.meta?.resolved && payloadDetails?.meta?.signed;

        if (wasSigned) {
          await stakesCollection.updateOne(
            { xummPayloadUUID: payloadResponse.uuid },
            { $set: { status: 'confirmed' } }
          );
          console.log(`✅ Payload ${payloadResponse.uuid} signed and confirmed.`);
        } else {
          console.log(`🕓 Payload ${payloadResponse.uuid} still pending or was rejected.`);
        }
      } catch (pollErr) {
        console.error('❌ Failed to check XUMM payload status:', pollErr.message);
      }
    }, 2000);
    
    return res.json(payloadResponse);

  } catch (error) {
    console.error('❌ Error creating XUMM stake payload:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message
    });

    return res.status(500).json({
      error: 'Failed to create stake payload',
      details: error?.response?.data?.message || error.message
    });
  }
});






// Define schema for storing AMM data in MongoDB
const ammSchema = new mongoose.Schema({
  sglcn_to_xrp: String,
  xrp_to_sglcn: String,
  timestamp: { type: Date, default: Date.now }
});

const AmmHistory = mongoose.model('AmmHistory', ammSchema);

// Fetch SGLCN-XRP price from the AMM pool
const fetchSglcnXrpAmm = async () => {
  const client = new Client("wss://s2.ripple.com");
  try {
    await client.connect();

    const ammResponse = await client.request({
      command: "amm_info",
      asset: { currency: "XRP" },
      asset2: {
        currency: "53656167756C6C436F696E000000000000000000",
        issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"
      }
    });

    const amm = ammResponse.result.amm;
    if (!amm || !amm.amount || !amm.amount2) {
      console.error("AMM pool not found or invalid.");
      return;
    }

    const xrpStr = amm.amount;
    const sglcnStr = amm.amount2.value;

    // Validate and parse XRP and SGLCN
    const xrp = parseFloat(xrpStr) / 1000000; // drops to XRP
    const sglcn = parseFloat(sglcnStr);

    // Check for NaN values
    if (isNaN(xrp) || isNaN(sglcn)) {
      console.error(`Invalid data: XRP = ${xrpStr}, SGLCN = ${sglcnStr}`);
      return;
    }

    // Calculate the conversion rates
    const sglcn_to_xrp = (xrp / sglcn).toFixed(6);
    const xrp_to_sglcn = (sglcn / xrp).toFixed(2);

// Inside fetchSglcnXrpAmm, before saving to MongoDB
const recent = await AmmHistory.findOne().sort({ timestamp: -1 });

if (recent && Date.now() - new Date(recent.timestamp).getTime() < INTERVAL_MS - 1000) {
  console.log("Skipping insert: too soon after last update.");
  return;
}

    
    // Log the calculated values
    console.log(`Calculated: sglcn_to_xrp = ${sglcn_to_xrp}, xrp_to_sglcn = ${xrp_to_sglcn}`);

    
    // Save to MongoDB
    const entry = new AmmHistory({
      sglcn_to_xrp,
      xrp_to_sglcn,
      timestamp: new Date().toISOString()
    });

    await entry.save(); // Save to MongoDB
    console.log("AMM data saved to MongoDB");

  } catch (err) {
    console.error("Error fetching AMM:", err.message);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
};

// Run immediately on startup
fetchSglcnXrpAmm();

// Fetch data periodically (every 5 minutes)
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
setInterval(fetchSglcnXrpAmm, INTERVAL_MS);

// API endpoint to get SGLCN-XRP data
app.get('/api/sglcns-xrp', async (req, res) => {
  try {
    const showHistory = req.query.history === 'true';

    if (showHistory) {
      // Fetch all history from MongoDB
      const history = await AmmHistory.find().sort({ timestamp: -1 }).limit(100000000); // Limit to last 100 entries
      if (!history.length) {
        return res.status(404).json({ error: "No AMM price history available." });
      }
      return res.json({ history });
    }

    // Return the latest entry
    const latest = await AmmHistory.findOne().sort({ timestamp: -1 });
    if (!latest) {
      return res.status(404).json({ error: "No AMM price data available." });
    }
    res.json(latest);

  } catch (err) {
    console.error("Error reading SGLCN-XRP history from MongoDB:", err.message);
    res.status(500).json({ error: "Failed to fetch price history." });
  }
});





app.post('/orderbook/scl-xau', async (req, res) => {
  const { side, amount, rate, wallet_address, mode = 'passive' } = req.body;

  if (!side || !['buy', 'sell'].includes(side) || !amount || !rate || !wallet_address) {
    return res.status(400).json({ error: 'Missing or invalid parameters.' });
  }

  const takerGets = side === 'buy'
    ? getCurrencyObj('XAU', amount, issuers)
    : getCurrencyObj('SeagullCoin', amount, issuers);

  const takerPays = side === 'buy'
    ? getCurrencyObj('SeagullCoin', amount * rate, issuers)
    : getCurrencyObj('XAU', amount * rate, issuers);

  const Flags = mode === 'ioc' ? 0x00020000 : 0x00000000; // tfImmediateOrCancel or none

  // If mode is "ioc", check if liquidity exists before proceeding
  if (mode === 'ioc') {
    try {
      const orderbookRequest = {
        command: "book_offers",
        taker_gets: takerGets,
        taker_pays: takerPays,
        ledger_index: "current"
      };

      const client = new xrpl.Client("wss://s2.ripple.com"); // or your preferred endpoint
      await client.connect();
      const orderbook = await client.request(orderbookRequest);
      await client.disconnect();

      const offers = orderbook.result.offers;
      if (!offers || offers.length === 0) {
        return res.status(400).json({ error: 'No matching offers available for immediate swap (liquidity too low).' });
      }
    } catch (err) {
      console.error('Orderbook check failed:', err);
      return res.status(500).json({ error: 'Failed to check orderbook liquidity.' });
    }
  }

  const payload = {
    txjson: {
      TransactionType: 'OfferCreate',
      Account: wallet_address,
      TakerGets: takerGets,
      TakerPays: takerPays,
      Flags
    },
    options: {
      submit: true,
      return_url: {
        app: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app/SeagullDex.html',
        web: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app/SeagullDex.html'
      }
    }
  };

  try {
    const { uuid, next } = await xumm.payload.create(payload);
    res.json({ success: true, uuid, next });
  } catch (e) {
    console.error('XUMM Payload creation failed:', e);
    res.status(500).json({ error: 'Failed to submit offer to orderbook.' });
  }
});

app.get('/orderbook/view/scl-xau', async (req, res) => {
  const client = new Client('wss://s1.ripple.com'); // Use mainnet URL if deploying to production

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('XRPL timeout')), ms)),
    ]);

  const TIMEOUT_CONNECT = 4000;
  const TIMEOUT_REQUEST = 10000;

  const SCL = {
    currency: '53656167756C6C436F696E000000000000000000', // SeagullCoin (hex)
    issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'
  };

  const XAU = {
    currency: 'XAU',
    issuer: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ'
  };

  try {
    await withTimeout(client.connect(), TIMEOUT_CONNECT);

    const [sclToXauRes, xauToSclRes] = await Promise.all([
      withTimeout(client.request({
        command: 'book_offers',
        taker_gets: SCL,
        taker_pays: XAU,
        limit: 100
      }), TIMEOUT_REQUEST),
      withTimeout(client.request({
        command: 'book_offers',
        taker_gets: XAU,
        taker_pays: SCL,
        limit: 100
      }), TIMEOUT_REQUEST)
    ]);

    const parseAmount = (amt) => {
      if (typeof amt === 'string') return Number(amt) / 1e6;
      if (amt?.value) return Number(amt.value);
      return 0;
    };

    const parseOffer = (offer) => {
      const get = offer.TakerGets;
      const pay = offer.TakerPays;

      const getsValue = parseAmount(get);
      const paysValue = parseAmount(pay);

      let price, amount;

      if (typeof get === 'object' && typeof pay === 'object') {
        price = paysValue / getsValue;
        amount = getsValue;
      } else {
        return null; // skip XRP-based offers
      }

      if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;

      return {
        price: Number(price.toFixed(8)),
        amount: Number(amount.toFixed(2)),
        offerAccount: offer.Account
      };
    };

    const asksRaw = (sclToXauRes.result.offers || []).map(parseOffer).filter(Boolean);
    const bidsRaw = (xauToSclRes.result.offers || []).map(parseOffer).filter(Boolean);

    const aggregateOffers = (offers, isAsc) => {
      const grouped = offers.reduce((acc, { price, amount }) => {
        const key = price.toFixed(7);
        acc[key] = (acc[key] || 0) + amount;
        return acc;
      }, {});

      let cumSum = 0;
      const result = Object.entries(grouped).map(([price, amount]) => {
        const p = parseFloat(price);
        const a = amount;
        const value = p * a;
        cumSum += a;
        return { price: p, amount: a, value, cumSum };
      });

      result.sort((a, b) => (isAsc ? a.price - b.price : b.price - a.price));
      return result;
    };

    const bids = aggregateOffers(bidsRaw, false);
    const asks = aggregateOffers(asksRaw, true);

    const highestBidPrice = bids.length ? bids[0].price : null;
    const lowestAskPrice = asks.length ? asks[0].price : null;

    const spread =
      highestBidPrice !== null && lowestAskPrice !== null
        ? Number((lowestAskPrice - highestBidPrice).toFixed(7))
        : null;

    const lastTradedPrice =
      highestBidPrice && lowestAskPrice
        ? Number(((highestBidPrice + lowestAskPrice) / 2).toFixed(7))
        : 0;

    await client.disconnect();

    res.json({
      bids,
      asks,
      summary: {
        spread,
        highestBidPrice,
        lowestAskPrice,
        lastTradedPrice
      }
    });

  } catch (error) {
    console.error('Orderbook fetch failed:', error.message || error);
    if (client.isConnected()) await client.disconnect();
    res.status(504).json({ error: 'Orderbook fetch timeout or failure' });
  }
});

app.get('/api/orderbook', async (req, res) => {
  const client = new Client('wss://s1.ripple.com');

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('XRPL timeout')), ms)),
    ]);

  const TIMEOUT_CONNECT = 4000;
  const TIMEOUT_REQUEST = 10000;

  const currency = '53656167756C6C436F696E000000000000000000'; // SGLCN (hex)
  const issuer = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
  const XRP = { currency: 'XRP' };

  try {
    await withTimeout(client.connect(), TIMEOUT_CONNECT);

    const bidsResponse = await withTimeout(
      client.request({
        command: 'book_offers',
        taker_gets: { currency, issuer },
        taker_pays: XRP,
        limit: 100,
      }),
      TIMEOUT_REQUEST
    );

    const asksResponse = await withTimeout(
      client.request({
        command: 'book_offers',
        taker_gets: XRP,
        taker_pays: { currency, issuer },
        limit: 100,
      }),
      TIMEOUT_REQUEST
    );

    const parseAmount = (amt) => {
      if (typeof amt === 'string') return Number(amt) / 1e6;
      if (amt?.value) return Number(amt.value);
      return 0;
    };

    const parseOffer = (offer) => {
      const get = offer.TakerGets;
      const pay = offer.TakerPays;

      const getsIsXRP = typeof get === 'string';
      const paysIsXRP = typeof pay === 'string';

      const getsValue = parseAmount(get);
      const paysValue = parseAmount(pay);

      let price, amount;

      if (getsIsXRP && !paysIsXRP) {
        price = getsValue / paysValue;
        amount = paysValue;
      } else if (!getsIsXRP && paysIsXRP) {
        price = paysValue / getsValue;
        amount = getsValue;
      } else {
        return null;
      }

      if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;

      return {
        price: Number(price.toFixed(8)),
        amount: Number(amount.toFixed(2)),
        offerAccount: offer.Account,
      };
    };

    const bidsRaw = (bidsResponse.result.offers || []).map(parseOffer).filter(Boolean);
    const asksRaw = (asksResponse.result.offers || []).map(parseOffer).filter(Boolean);

    const aggregateOffers = (offers, isAsc) => {
      const grouped = offers.reduce((acc, { price, amount }) => {
        const key = price.toFixed(7);
        acc[key] = (acc[key] || 0) + amount;
        return acc;
      }, {});

      let cumSum = 0;
      const result = Object.entries(grouped).map(([price, amount]) => {
        const p = parseFloat(price);
        const a = amount;
        const value = p * a;
        cumSum += a;
        return { price: p, amount: a, value, cumSum };
      });

      result.sort((a, b) => (isAsc ? a.price - b.price : b.price - a.price));
      return result;
    };

    const bids = aggregateOffers(bidsRaw, false);
    const asks = aggregateOffers(asksRaw, true);

    const highestBidPrice = bids.length ? bids[0].price : null;
    const lowestAskPrice = asks.length ? asks[0].price : null;

    const spread =
      highestBidPrice !== null && lowestAskPrice !== null
        ? Number((lowestAskPrice - highestBidPrice).toFixed(7))
        : null;

    const lastTradedPrice =
      highestBidPrice && lowestAskPrice
        ? Number(((highestBidPrice + lowestAskPrice) / 2).toFixed(7))
        : 0;

    await client.disconnect();

    res.json({
      bids,
      asks,
      summary: {
        spread,
        highestBidPrice,
        lowestAskPrice,
        lastTradedPrice,
      },
    });
  
} catch (error) {
    console.error('Orderbook fetch failed:', error.message || error);
    if (client.isConnected()) await client.disconnect();
    res.status(504).json({ error: 'Orderbook fetch timeout or failure' });
  }
});
 // In-memory history (lost on restart)








setInterval(async () => {
  const client = new Client("wss://s2.ripple.com");
  try {
    await client.connect();
    const ammResponse = await client.request({
      command: "amm_info",
      asset: { currency: "XAU", issuer: "rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ" },
      asset2: {
        currency: "53656167756C6C436F696E000000000000000000",
        issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"
      }
    });

    const amm = ammResponse.result.amm;
    if (amm && amm.amount && amm.amount2) {
      const xau = parseFloat(amm.amount.value);
      const sglcn = parseFloat(amm.amount2.value);
      const entry = {
        sglcn_to_xau: (xau / sglcn).toFixed(6),
        xau_to_sglcn: (sglcn / xau).toFixed(2),
        timestamp: new Date()
      };

      // ✅ Uniqueness check before saving to DB
      const recent = await SGLCNXAUPrice.findOne({
        timestamp: { $gte: new Date(Date.now() - 60 * 1000) }
      });

      if (!recent) {
        await SGLCNXAUPrice.create(entry);
        console.log("Saved AMM entry to DB");
      } else {
        console.log("Skipped saving duplicate entry");
      }

      // Still write to memory + file if you want
      ammHistory.unshift(entry);
      if (ammHistory.length > 35040) ammHistory.pop();
      fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history: ammHistory }, null, 2));
    }

  } catch (err) {
    console.error("AMM polling error:", err.message);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}, 300000); // every 5 mins

// Single endpoint with optional ?history=true
app.get('/api/sglcn-xau', async (req, res) => {
  const showHistory = req.query.history === 'true';

  if (showHistory) {
    try {
      const history = await SGLCNXAUPrice.find().sort({ timestamp: -1 }).limit(100000);
      return res.json({ history });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  const client = new Client("wss://s2.ripple.com");

  try {
    await client.connect();

    const ammResponse = await client.request({
      command: "amm_info",
      asset: { currency: "XAU", issuer: "rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ" },
      asset2: { currency: "53656167756C6C436F696E000000000000000000", issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno" }
    });

    const amm = ammResponse.result.amm;
    if (!amm || !amm.amount || !amm.amount2) {
      return res.status(404).json({ error: "AMM pool not found or invalid." });
    }

    const xau = parseFloat(amm.amount.value);
    const sglcn = parseFloat(amm.amount2.value);

    const result = {
      sglcn_to_xau: parseFloat((xau / sglcn).toFixed(6)),
      xau_to_sglcn: parseFloat((sglcn / xau).toFixed(2)),
      timestamp: new Date()
    };

    res.json(result);

  } catch (err) {
    console.error("Error fetching AMM price:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
});




// --- Currency issuers ---
const issuers = {
  SGLCN_ISSUER: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
  XAU_ISSUER: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ'
};

// --- Utility to get currency object for XRPL transactions ---
function getCurrencyObj(currency, amount, { SGLCN_ISSUER, XAU_ISSUER }) {
  if (currency === 'XRP') {
    // XRP amount in drops as string
    return Math.floor(parseFloat(amount) * 1000000).toString();
  }

  if (currency === 'SeagullCoin') {
    return {
      currency: '53656167756C6C436F696E000000000000000000',
      issuer: SGLCN_ISSUER,
      value: parseFloat(amount).toFixed(6).toString()
    };
  }

  if (currency === 'XAU') {
    return {
      currency: 'XAU',
      issuer: XAU_ISSUER,
      value: parseFloat(amount).toFixed(6).toString()
    };
  }

  throw new Error('Unsupported currency');
}

// --- Utility to get book currency for orderbook request ---
function getBookCurrency(symbol, { SGLCN_ISSUER, XAU_ISSUER }) {
  if (symbol === 'XRP') return { currency: 'XRP' };
  if (symbol === 'SeagullCoin') return { currency: '53656167756C6C436F696E000000000000000000', issuer: SGLCN_ISSUER };
  if (symbol === 'XAU') return { currency: 'XAU', issuer: XAU_ISSUER };
  throw new Error('Unsupported currency in book');
}

// --- Fetch the best market rate from XRPL orderbook ---
const getMarketRate = async (from_currency, to_currency, issuers) => {
  const client = new xrpl.Client('wss://s1.ripple.com');

  const getCurrencyObj = (currency) => {
    if (currency === 'XRP') return { currency: 'XRP' };
    return {
      currency:
        currency === 'SeagullCoin'
          ? '53656167756C6C436F696E000000000000000000'
          : 'XAU',
      issuer: currency === 'SeagullCoin' ? issuers.SGLCN_ISSUER : issuers.XAU_ISSUER,
    };
  };

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('XRPL timeout')), ms)
      ),
    ]);

  try {
    await withTimeout(client.connect(), 1800000);

    const taker_gets = getCurrencyObj(to_currency);
    const taker_pays = getCurrencyObj(from_currency);

    const response = await withTimeout(
      client.request({
        command: 'book_offers',
        taker_gets,
        taker_pays,
        limit: 1,
      }),
      8000
    );

    await client.disconnect();

    const topOffer = response.result.offers[0];
    if (!topOffer) throw new Error('No liquidity in orderbook');

    const parseAmount = (amt) => {
      if (typeof amt === 'string') return parseFloat(amt) / 1e6;
      if (amt.value) return parseFloat(amt.value);
      return 0;
    };

    const price =
      parseAmount(topOffer.TakerPays) / parseAmount(topOffer.TakerGets);
    return price;
  } catch (err) {
    if (client.isConnected()) await client.disconnect();
    throw new Error(`Market rate fetch failed: ${err.message}`);
  }
};



// --- Express route to create swap offer via XUMM ---
app.post('/swap', async (req, res) => {
  const { from_currency, to_currency, amount, wallet_address } = req.body;

  if (!from_currency || !to_currency || !amount || !wallet_address) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  if (from_currency === to_currency) {
    return res.status(400).json({ error: 'Currencies must differ.' });
  }

  // Allow only the supported currencies
  const supported = ['SeagullCoin', 'XRP', 'XAU'];
  if (!supported.includes(from_currency) || !supported.includes(to_currency)) {
    return res.status(400).json({ error: 'Unsupported currencies.' });
  }

  try {
    const rate = await getMarketRate(from_currency, to_currency, issuers);
    const fromAmt = parseFloat(amount);
    // Calculate amount to receive
    const toAmt = from_currency === 'SeagullCoin'
     ? (fromAmt * rate)
     : (fromAmt / rate);

    // Compose currency objects for the transaction
    const takerGets = getCurrencyObj(from_currency, fromAmt, issuers);
    const takerPays = getCurrencyObj(to_currency, toAmt, issuers);

    // XUMM payload to create the OfferCreate transaction
    const payload = {
      txjson: {
        TransactionType: 'OfferCreate',
        Account: wallet_address,
        TakerGets: takerGets,
        TakerPays: takerPays,
        Flags: 0x00020000 // tfImmediateOrCancel
      },
      options: {
        submit: true,
        return_url: {
          app: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app/SeagullDex.html',
          web: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app/SeagullDex.html'
        }
      }
    };

    // Create payload on XUMM and get UUID + URLs
    const { uuid, next } = await xumm.payload.create(payload);

    // Respond with payload info and swap details
    res.json({
      success: true,
      uuid,
      next,
      rate,
      swap_details: {
        from: {
          currency: from_currency,
          amount: fromAmt,
          issuer: from_currency === 'XRP' ? null : (from_currency === 'SeagullCoin' ? issuers.SGLCN_ISSUER : issuers.XAU_ISSUER)
        },
        to: {
          currency: to_currency,
          amount: toAmt,
          issuer: to_currency === 'XRP' ? null : (to_currency === 'SeagullCoin' ? issuers.SGLCN_ISSUER : issuers.XAU_ISSUER)
        }
      }
    });

  } catch (err) {
    console.error('Swap error:', err);
    res.status(500).json({ error: err.message || 'Swap failed.' });
  }
});

app.get('/rate-preview', async (req, res) => {
  const { from, to } = req.query;

  const validCurrencies = ['XRP', 'SeagullCoin', 'XAU'];
  if (!from || !to || !validCurrencies.includes(from) || !validCurrencies.includes(to)) {
    return res.status(400).json({ error: 'Invalid from/to parameters.' });
  }

  if (from === to) {
    return res.status(400).json({ error: 'From and To currencies must differ.' });
  }

  try {
    const rate = await getMarketRate(from, to, issuers);

    res.json({
      from: {
        currency: from,
        issuer: from === 'XRP' ? null : (from === 'SeagullCoin' ? issuers.SGLCN_ISSUER : from === 'XAU' ? issuers.XAU_ISSUER : null)
      },
      to: {
        currency: to,
        issuer: to === 'XRP' ? null : (to === 'SeagullCoin' ? issuers.SGLCN_ISSUER : to === 'XAU' ? issuers.XAU_ISSUER : null)
      },
      rate
    });
  } catch (err1) {
    // Try the reverse direction
    try {
      const reverseRate = await getMarketRate(to, from, issuers);
      res.json({
        from: {
          currency: from,
          issuer: from === 'XRP' ? null : (from === 'SeagullCoin' ? issuers.SGLCN_ISSUER : from === 'XAU' ? issuers.XAU_ISSUER : null)
        },
        to: {
          currency: to,
          issuer: to === 'XRP' ? null : (to === 'SeagullCoin' ? issuers.SGLCN_ISSUER : to === 'XAU' ? issuers.XAU_ISSUER : null)
        },
        rate: 1 / reverseRate
      });
    } catch (err2) {
      console.error('Both directions failed:', err1.message, '|', err2.message);
      res.status(404).json({ error: 'No offers found in either direction.' });
    }
  }
});


app.get('/amm/view/sglcn-xau', async (req, res) => {
  const client = new Client("wss://s2.ripple.com");

  try {
    await client.connect();

    const { result } = await client.request({
      command: "amm_info",
      asset: {
        currency: "XAU",
        issuer: "rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ"
      },
      asset2: {
        currency: "53656167756C6C436F696E000000000000000000", // SeagullCoin (hex)
        issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"
      }
    });

    const amm = result.amm;
    const base = parseFloat(amm.amount?.value || "0");
    const quote = parseFloat(amm.amount2?.value || "0");

    const price_SGLCN_per_XAU = base > 0 ? quote / base : 0;
    const price_XAU_per_SGLCN = quote > 0 ? base / quote : 0;

    await client.disconnect();

    res.json({
      amm: amm.account,
      price_SGLCN_per_XAU: price_SGLCN_per_XAU.toFixed(6),
      price_XAU_per_SGLCN: price_XAU_per_SGLCN.toFixed(10),
      liquidity: { 
        base: base.toFixed(4),
        quote: quote.toFixed(4)
      },
      trading_fee: `${amm.trading_fee}%`
    });

  } catch (e) {
    console.error("AMM info error:", e);
    try { await client.disconnect(); } catch {}
    res.status(500).json({ error: e?.data?.error_message || e?.message || "Unknown error" });
  }
});

app.post('/swap/amm/sglcn-xau', async (req, res) => {
  try {
    const { Account, Amount } = req.body;

    if (!Account || !Amount || typeof Amount !== 'object' || !Amount.value) {
      return res.status(400).json({ error: 'Missing or invalid Account or Amount' });
    }

    const seagullCoin = {
      currency: '53656167756C6C436F696E000000000000000000', // "SeagullCoin"
      issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'
    };

    const xau = {
      currency: '5841550000000000000000000000000000000000', // "XAU"
      issuer: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ'
    };

    const payload = {
      txjson: {
        TransactionType: 'AMMSwap',
        Account,
        Asset: seagullCoin,
        Asset2: xau,
        Amount: String(Amount.value), // ✅ Correct format for swap input
        Flags: 0
      },
      options: {
        submit: true,
        return_url: {
          app: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app/SeagullDex.html',
          web: 'https://seagullcoin-dex-uaj3x.ondigitalocean.app/SeagullDex.html'
        }
      }
    };

    const result = await xumm.payload.create(payload);

    if (!result?.uuid || !result?.next?.always) {
      console.error('XUMM payload creation failed:', result);
      return res.status(500).json({ error: 'Failed to create XUMM payload', details: result });
    }

    return res.status(200).json({
      uuid: result.uuid,
      next: result.next.always
    });

  } catch (error) {
    console.error('AMM swap error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

async function performAMMSwap(account, amount) {
  await client.connect();

  const wallet = xrpl.Wallet.fromSeed(SERVICE_WALLET_SEED);

  const seagullCoin = {
    currency: '53656167756C6C436F696E000000000000000000',
    issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
  };

  const xau = {
    currency: '5841550000000000000000000000000000000000',
    issuer: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ',
  };

  const swapTx = {
    TransactionType: 'AMMSwap',
    Account: account,
    Asset: seagullCoin,
    Asset2: xau,
    Amount: {
      currency: seagullCoin.currency,
      issuer: seagullCoin.issuer,
      value: String(amount),
    },
    Flags: 0,
  };

  const prepared = await client.autofill(swapTx);
  const signed = wallet.sign(prepared);
  const tx = await client.submitAndWait(signed.tx_blob);

  await client.disconnect();

  return tx;
}

app.post('/create-merch-order', async (req, res) => {
  const { productName, priceSGLCN, wallet, shipping, address } = req.body;

  const price = parseFloat(priceSGLCN);
  if (isNaN(price) || price <= 0) {
    return res.status(400).json({ error: 'Invalid priceSGLCN value' });
  }

  const payload = {
    txjson: {
      TransactionType: 'Payment',
      Destination: 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U', // Your receiving wallet
      Amount: {
        currency: 'SGLCN',
        value: price.toString(),
        issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'
      }
    },
    custom_meta: {
      identifier: `MERCH-${Date.now()}-${productName}`,
      blob: {
        product: productName,
        shipping,
        wallet,
        address
      }
    }
  };

  try {
    const result = await xumm.payload.create(payload);

    if (!result || !result.uuid || !result.next) {
      throw new Error('Invalid response from XUMM: ' + JSON.stringify(result));
    }

    res.json({
      success: true,
      payloadUUID: result.uuid,
      payloadURL: result.next.always
    });
  } catch (error) {
    console.error('❌ XUMM Payload Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment payload',
      message: error.message
    });
  }
});

// ✅ Gift card creation endpoint

// Define TokenModel
const TokensModel = mongoose.model('Tokens', new mongoose.Schema({
  token: String,
  orderIdentifier: String,
  used: { type: Boolean, default: false },
  expiresAt: Date
}));


app.post("/create-giftcard-order", async (req, res) => {
  const { brand, amount, priceSGLCN, wallet, recipientEmail } = req.body;

  if (!brand || !amount || !priceSGLCN || !wallet || !recipientEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const price = parseFloat(priceSGLCN);
  if (isNaN(price) || price <= 0) {
    return res.status(400).json({ error: "Invalid priceSGLCN value" });
  }

  try {
    const tokens = randomBytes(32).toString('hex');   // Generate token **first**
    const identifier = `GIFTCARD-${Date.now()}-${brand}-${amount}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const payload = {
      txjson: {
        TransactionType: "Payment",
        Destination: "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U",
        Amount: {
          currency: "53656167756C6F696E000000000000000000", // HEX for SeagullCoin (check spelling)
          issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno",
          value: price.toString()
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from("GiftcardOrder", "utf8").toString("hex"),
              MemoData: Buffer.from(`${brand}-${amount}`, "utf8").toString("hex")
            }
          }
        ]
      },
      options: {
        submit: true,
        expire: 300,
        return_url: {
          app: `https://seagullcoin-dex-uaj3x.ondigitalocean.app/redeem?tokens=${tokens}`,
          web: `https://seagullcoin-dex-uaj3x.ondigitalocean.app/redeem?tokens=${tokens}`,
        }
      },
      custom_meta: {
        identifier,
        blob: { brand, amount, wallet, recipientEmail, token }
      }
    };

    // Create payload on XUMM
    const created = await xumm.payload.create(payload);

    // Save order to DB
    await GiftCardOrder.create({
      identifier,
      brand,
      amount,
      wallet,
      recipientEmail,
      priceSGLCN: price,
      status: "pending",
      giftCardCode: null, // will fill after fulfillment
      token  // Save token for reference
    });

    // Save token linked to order
    await TokensModel.create({
      tokens,
      orderIdentifier: identifier,
      expiresAt,
      used: false
    });

    // Optionally send email with redeem link (token)
    // sendGiftCardEmail({ recipientEmail, brand, amount, identifier, token });

    res.json({
      success: true,
      uuid: created.uuid,
      next: created.next.always
    });

  } catch (err) {
    console.error("❌ XUMM Payload Error:", err.message || err);
    res.status(500).json({ error: "Failed to create giftcard payment." });
  }
});
    

app.post('/xumm-webhook', async (req, res) => {
  const data = req.body;

  console.log('Webhook received:', data);

  if (data.signed === true) {
    const { identifier, blob } = data.payload.custom_meta || {};
    const { brand, amount, wallet, recipientEmail } = blob || {};

    console.log(`✅ Payment confirmed: ${identifier}`);

    try {
      // ✅ Update the order status in DB
      const updated = await GiftCardOrder.findOneAndUpdate(
        { identifier },
        { status: 'paid', fulfilledAt: new Date() },
        { new: true }
      );

      if (!updated) {
        console.warn(`⚠️ No matching order found for identifier ${identifier}`);
      } else {
        // TODO: fulfill gift card logic (email code, mark as sent, etc.)
        console.log(`🎁 Fulfilled gift card: ${brand} x${amount} to ${recipientEmail}`);
      }

    } catch (err) {
      console.error("❌ Failed to update order:", err.message);
    }

    res.status(200).send('OK');
  } else {
    console.log('❌ Payment not signed or rejected.');
    res.status(200).send('OK');
  }
});
      

const MONGODB_URI = process.env.MONGODB_URI;

// 2. Use existing connection in route
app.get('/test-mongodb', (req, res) => {
  const status = mongoose.connection.readyState; // 1 = connected
  if (status === 1) {
    res.send('✅ MongoDB is currently connected');
  } else {
    res.status(500).send('❌ MongoDB is NOT connected');
  }
});

app.get("/redeem", async (req, res) => {
  const token = req.query.tokens;

  if (!tokens) return res.status(400).send("❌ Missing token.");

  const gift = await TokensModel.findOne({ tokens });
  if (!gift || gift.used || gift.expiresAt < new Date()) {
    return res.status(404).send("❌ Invalid or expired token.");
  }

  const order = await GiftCardOrder.findOne({ identifier: gift.orderIdentifier });
  if (!order || order.status !== 'paid') {
    return res.status(404).send("❌ Gift card not available yet.");
  }

  // Optional: Mark token as used now or later
  // gift.used = true;
  // await gift.save();

  res.send(`
    <html>
      <head>
        <title>🎁 Your Gift Card</title>
      </head>
      <body style="background-color: #000; color: #fff; font-family: Arial; padding: 40px;">
        <div style="max-width: 600px; margin: auto; background: #111; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(255,255,255,0.2);">
          <h1 style="color: #4CAF50;">🎉 Your ${order.brand} Gift Card</h1>
          <p style="font-size: 18px;">Amount: <strong>$${order.amount}</strong></p>
          <p style="font-size: 16px; margin-top: 20px;">Gift Card Code:</p>
          <div style="background: #222; padding: 15px; font-size: 20px; font-family: monospace; border-radius: 5px;">
            ${order.giftCardCode || '🔒 Not set yet'}
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">This code has not been marked as redeemed yet.</p>
        </div>
      </body>
    </html>
  `);
});

app.post('/api/wallets/generate', async (req, res) => {
  try {
    const uniquePart = randomBytes(12).toString('hex').toUpperCase();
    const wallet = `SEAGULL${uniquePart}`;
    const seed = randomBytes(32).toString('hex');

    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' },
      custom_meta: {
        identifier: 'wallet_setup',
        blob: wallet,
      },
    });

    // Store only non-sensitive wallet ID + payload UUID
    await UserWallet.create({
  wallet,
  xrpl_address: null,  // set later when user links their XRPL address
  xumm_uuid: payload.uuid,
});


    res.json({
      success: true,
      wallet,
      seed, // shown only once
      xumm: {
        link: payload.next.always,
        qr: payload.refs.qr_png,
        uuid: payload.uuid,
      },
      warning: "You are the only one who will see this seed. Save it securely. If lost, your wallet cannot be recovered.",
    });
  } catch (err) {
    console.error(err); // Avoid logging the seed!
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/wallets/check-sign/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const payload = await xumm.payload.get(uuid);

    if (!payload) {
      return res.status(404).json({ error: 'Payload not found' });
    }

    const signed = payload.response?.signed || false;
    const account = payload.response?.account || null;

    if (signed && account) {
      // Update DB if needed
      await UserWallet.updateOne({ xumm_uuid: uuid }, { xrpl_address: account });
    }

    return res.json({ signed, xrpl_address: account });
  } catch (err) {
    console.error('Error fetching payload:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/wallets/init-signin', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' },
      custom_meta: {
        identifier: 'wallet_setup',
      },
    });

    res.json({
      success: true,
      xumm: {
        link: payload.next.always,
        uuid: payload.uuid,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'XUMM sign-in failed' });
  }
});


app.get('/api/wallets/complete-signin/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const result = await xumm.payload.get(uuid);
    console.log(`XUMM payload for ${uuid}:`, result);  // DEBUG

    // Depending on XUMM version:
    const signed = result.response?.signed || result.meta?.signed;
    const account = result.response?.account || null;

    if (!signed) {
      return res.json({ success: true, signed: false });
    }

    // Signed! Proceed to wallet creation
    const uniquePart = randomBytes(12).toString('hex').toUpperCase();
    const wallet = `SEAGULL${uniquePart}`;
    const seed = randomBytes(32).toString('hex');

    await UserWallet.create({
      wallet,
      xrpl_address: account,
      xumm_uuid: uuid,
    });

    return res.json({
      success: true,
      signed: true,
      xrpl_address: account,
      wallet,
      seed,
      warning: 'Save your seed securely. We cannot recover it later.',
    });
  } catch (err) {
    console.error('Error in complete-signin:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/wallets/signin-init
app.post('/api/wallets/signin-seed', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' },
      custom_meta: {
        identifier: 'wallet_setup_init',
      },
    });

    // Save payload UUID, mark as pending
    await WalletSignRequest.create({
      xumm_uuid: payload.uuid,
      status: 'pending',
    });

    res.json({
      success: true,
      xumm: {
        link: payload.next.always,
        qr: payload.refs.qr_png,
        uuid: payload.uuid,
      }
    });
  } catch (err) {
    console.error('Init error:', err.message);
    res.status(500).json({ success: false });
  }
});


// POST /api/wallets/complete
app.post('/api/wallets/complete', async (req, res) => {
  const { uuid } = req.body;
  try {
    const payloadResult = await xumm.payload.get(uuid);
    if (payloadResult.meta.signed !== true) {
      return res.status(400).json({ success: false, error: 'Not signed yet' });
    }

    const xrpl_address = payloadResult.response.account;
    const uniquePart = randomBytes(12).toString('hex').toUpperCase();
    const wallet = `SEAGULL${uniquePart}`;
    const seed = randomBytes(32).toString('hex');

    // Save wallet
    await UserWallet.create({
      wallet,
      seed,
      xrpl_address,
      xumm_uuid: uuid,
    });

    res.json({
      success: true,
      wallet,
      seed,
      xrpl_address,
      warning: "This seed will not be shown again. Save it securely.",
    });
  } catch (err) {
    console.error('Wallet complete error:', err.message);
    res.status(500).json({ success: false });
  }
});

app.get('/api/wallets/xumm-callback/:uuid', async (req, res) => {
  const { uuid } = req.params;

  try {
    const result = await xumm.payload.get(uuid);

    if (result.meta.signed === true) {
      const xrplAddress = result.response.account;

      // ✅ Check if this uuid has already been used
      const existingWallet = await UserWallet.findOne({ xumm_uuid: uuid });

      if (existingWallet) {
        return res.json({
          success: false,
          message: 'Wallet already generated for this sign-in',
        });
      }

     // 🔐 Generate only once
      const uniquePart = randomBytes(12).toString('hex').toUpperCase();
      const wallet = `SEAGULL${uniquePart}`;
      const seed = randomBytes(32).toString('hex');
      const hashedSeed = hashSeed(seed);
      
      const newWallet = await UserWallet.create({
        wallet,
        xrpl_address: xrplAddress,
        xumm_uuid: uuid,
        hashed_seed: hashedSeed,  // keys match schema, values are your variables
      });

      return res.json({
        success: true,
        message: 'Wallet created after successful sign-in',
        xrpl_address: xrplAddress,
        wallet_id: newWallet._id,
        wallet,
        seed,
        warning: "You will not see this seed again. Save it securely.",
      });
    } else {
      return res.status(400).json({ success: false, error: 'User declined the sign request' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve payload status' });
  }
});

app.get('/check-login', async (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) return res.status(400).json({ error: 'Missing UUID' });

  try {
    const payload = await xumm.payload.get(uuid);

    if (payload.meta.signed && payload.response.account) {
      const xrplAddress = payload.response.account;

      let userWallet = await Wallet.findOne({ xrpl_address: xrplAddress });

      let seedToSend = null;  // Only returned if wallet is new

// ✅ DENY minting if already minted
if (userWallet && userWallet.hasMinted) {
  return res.status(403).json({ error: 'Already minted' });
}
      
      if (!userWallet) {
        // Generate seed & hashed seed
        const seed = randomBytes(32).toString('hex');
        const hashedSeed = hashSeed(seed);

        const maxAttempts = 5;
        let attempt = 0;
        let saved = false;

        while (attempt < maxAttempts && !saved) {
          const walletStr = 'SEAGULL' + randomBytes(12).toString('hex').toUpperCase();

          try {
            userWallet = new Wallet({
              wallet: walletStr,
              hashed_seed: hashedSeed,
              xrpl_address: xrplAddress,
              xumm_uuid: uuid,
              bridgedFromXrpl: true,
              hasMinted: false, // ✅ Add this line
            });

            await userWallet.save();
            saved = true;
            seedToSend = seed;
          } catch (err) {
            if (err.code === 11000 && err.keyPattern?.wallet) {
              console.warn('⚠️ Duplicate wallet, retrying...');
              attempt++;
            } else {
              console.error('Wallet save error:', err);
              return res.status(500).json({ error: 'Could not save wallet' });
            }
          }
        }

        if (!saved) {
          return res.status(500).json({ error: 'Failed to create unique wallet' });
        }
      }

      // ✅ Include hasMinted in the response
      const response = {
        loggedIn: true,
        account: xrplAddress,
        seagullWallet: userWallet.wallet,
        uuid,
        walletDetails: {
          bridgedFromXrpl: userWallet.bridgedFromXrpl,
          isCustodial: userWallet.isCustodial,
          hasMinted: userWallet.hasMinted, // ✅
          l2Balance: userWallet.l2Balance,
          createdAt: userWallet.createdAt,
          updatedAt: userWallet.updatedAt
        }
      };

      if (seedToSend) {
        response.seed = seedToSend;
      }

      return res.json(response);

    } else {
      return res.json({ loggedIn: false });
    }
  } catch (err) {
    console.error('Login check error:', err);
    return res.status(500).json({ error: 'Error checking login' });
  }
});

let allBlocks = [];  

function fetchBlocks() {
  return fetch('https://seagullcoin-dex-uaj3x.ondigitalocean.app/api/blocks').then(res => res.json());
}

// Then call it like this:
fetchBlocks().then(data => {
  allBlocks = data;
  renderBlocks();
});


app.post('/mine', async (req, res) => {
  try {
    const previousBlock = await Block.findOne().sort({ index: -1 });
    if (!previousBlock) {
      return res.status(400).json({ error: 'Genesis block not found.' });
    }

    const transactions = req.body.transactions;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions must be an array' });
    }

    const newBlock = new Block({
      index: previousBlock.index + 1,
      previousHash: previousBlock.hash,
      timestamp: new Date(),
      transactions,
      nonce: 0,
    });

    newBlock.hash = calculateHash(newBlock.toObject());
    await newBlock.save();

    res.json(newBlock);
  } catch (err) {
    console.error('❌ Error in /mine:', err);
    res.status(500).json({ error: 'Failed to mine block' });
  }
});





app.get('/generate-keys', (req, res) => {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { format: 'pem', type: 'spki' },
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' }
    });

    res.json({
      publicKey,
      privateKey
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/test-sign', (req, res) => {
  const data = 'hello-blockchain';
  const signature = signBlock(data, privateKeyPem);
  res.send({ data, signature });
});

app.get('/api/blocks', async (req, res) => {
  const blocks = await Block.find().sort({ index: -1 });
  res.json(blocks);
});

app.get('/api/block/:hash', (req, res) => {
  const block = allBlocks.find(b => b.hash === req.params.hash);
  if (!block) return res.status(404).json({ error: 'Not found' });
  res.json(block);
});

app.get('/explorer/block/:hash', async (req, res) => {
  const hash = req.params.hash;
  const blocks = await fetchBlocks(); // however you're getting blocks
  const block = blocks.find(b => b.hash === hash);
  if (!block) return res.status(404).send('Block not found');
  res.render('block-detail', { block }); // or send HTML
});



app.get('/api/address/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const upperAddress = address.toUpperCase();

    const wallet = await Wallet.findOne({ wallet: upperAddress }).lean();
    if (!wallet) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Find blocks where address is sender or receiver
    const matchingBlocks = await Block.find({
      transactions: {
        $elemMatch: {
          $or: [{ from: upperAddress }, { to: upperAddress }]
        }
      }
    }).lean();

    const transactions = matchingBlocks.flatMap(block =>
      block.transactions
        .filter(tx => tx.from === upperAddress || tx.to === upperAddress)
        .map(tx => ({
          ...tx,
          blockHash: block.hash,
          timestamp: block.timestamp
        }))
    );

    return res.json({
      address: wallet.wallet,
      balance: wallet.balance,
      xrpl_address: wallet.xrpl_address,
      isGenesisWallet: wallet.isGenesisWallet,
      transactions
    });

  } catch (err) {
    console.error('Address API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/metrics', (req, res) => {
  res.json({
    blocks: blockchain.length,
    poolSize: transactionPool.length,
    tps: confirmedTxCount,
    totalTx: txCount,
  });
});

// Tier 1 - Basic Stake
app.get('/stake-payload-basic/:walletAddress', async (req, res) => {
  await createStakePayload(req, res, '2500000');
});

// Tier 2 - Premium Stake
app.get('/stake-payload-premium/:walletAddress', async (req, res) => {
  await createStakePayload(req, res, '5000000');
});



const balances = new Map([
  ['SEAGULLD1DFB4670F7CA58AB0B03B62', 589000000],
  ['SEAGULL03A8138F0F1BB26C50A4A44F', 0]
]);

const nonces = new Map([
  ['SEAGULLD1DFB4670F7CA58AB0B03B62', 0]
]);

app.post('/tx/send', (req, res) => {
  const { from, to, amount, nonce, signature } = req.body;

  // Basic validation
  if (!from || !to || typeof amount !== 'number' || nonce == null || !signature) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  // Check balance
  const fromBalance = balances.get(from) ?? 0;
  if (fromBalance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Check nonce
  const currentNonce = nonces.get(from) ?? 0;
  if (nonce !== currentNonce) {
    return res.status(400).json({ error: 'Invalid nonce' });
  }

  // TODO: Verify signature here, for now we trust it
  const isValidSignature = true;
  if (!isValidSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Update balances
  balances.set(from, fromBalance - amount);
  balances.set(to, (balances.get(to) ?? 0) + amount);

  // Update nonce
  nonces.set(from, currentNonce + 1);

  res.json({ success: true, tx: { from, to, amount, nonce } });
});

app.post('/check-webhook', async (req, res) => {
  const { uuid, signed } = req.body;
  await stakesCollection.updateOne(
    { xummPayloadUUID: uuid },
    { $set: { status: signed ? 'confirmed' : 'rejected' } }
  );
  res.sendStatus(200);
});

app.get('/checking-login', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: 'Missing UUID' });

  try {
    const payload = await xumm.payload.get(uuid);
    const isSigned = payload?.meta?.signed && payload?.meta?.resolved;

    if (isSigned) {
      const db = await connectDB();
      const stakesCollection = db.collection('stakes');
      await stakesCollection.updateOne(
        { xummPayloadUUID: uuid },
        { $set: { status: 'confirmed' } }
      );
    }

    res.json({ uuid, signed: isSigned, status: isSigned ? 'confirmed' : 'pending' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check payload status' });
  }
});

app.post('/unstake', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !walletAddress.startsWith('r')) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const db = await connectDB();
    const stakesCollection = db.collection('stakes');

    // Find the latest confirmed stake for this wallet
    const stake = await stakesCollection.findOne({
      walletAddress,
      status: 'confirmed'
    });

    if (!stake) {
      return res.status(404).json({ error: 'No confirmed stake found' });
    }

    const now = new Date();
    const stakedAt = new Date(stake.timestamp);
    const lockDurations = {
  '1 Year': 365 * 24 * 60 * 60 * 1000,
  '3 Year': 3 * 365 * 24 * 60 * 60 * 1000,
  '5 Year': 5 * 365 * 24 * 60 * 60 * 1000,
  'Test': 60 * 1000 // 1 minute for testing
};
  

const requiredDuration = lockDurations[stake.tier];
    if (!requiredDuration || now - stakedAt < requiredDuration) {
      return res.status(403).json({ error: 'Stake is not yet eligible for unstaking' });
    }

    // Create a refund payload via XUMM
    const refundPayload = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: walletAddress,
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000',
          issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
          value: String(stake.amount)
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('Unstake', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(stake.xummPayloadUUID, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      options: {
        submit: true,
        expire: 10
      }
    });

    if (!refundPayload?.uuid) {
      throw new Error('XUMM refund payload creation failed');
    }

    // Update the stake record to reflect pending unstake
    await stakesCollection.updateOne(
      { _id: stake._id },
      {
        $set: {
          status: 'unstaking',
          unstakeUUID: refundPayload.uuid,
          unstakeInitiatedAt: new Date()
        }
      }
    );

    res.json({
      message: 'Unstake initiated. Please sign in XUMM.',
      payload: refundPayload
    });

  } catch (err) {
    console.error('Error in /unstake:', err);
    res.status(500).json({ error: 'Unstaking failed', details: err.message });
  }
});

app.get('/check-unstake', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: 'Missing uuid' });

  try {
    const payload = await xumm.payload.get(uuid);
    const signed = payload?.meta?.signed === true;
    const resolved = payload?.meta?.resolved === true;

    if (signed && resolved) {
      const db = await connectDB();
      const stakesCollection = db.collection('stakes');
      await stakesCollection.updateOne(
        { unstakeUUID: uuid },
        { $set: { status: 'unstaked', unstakedAt: new Date() } }
      );
      return res.json({ status: 'unstaked' });
    }

    res.json({ status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check failed' });
  }
});

// /api/staking-info?wallet=xxxxx
app.get('/api/staking-info', async (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });

  const stakes = await db.collection('stakes').find({ wallet }).toArray();
  const result = stakes.map(s => ({
    tier: s.tier,
    endTime: s.endTime // ensure it's already stored or calculated server-side
  }));

  res.json(result);
});

app.get('/staking-info/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress;
  const db = await connectDB();
  const stakesCollection = db.collection('stakes');

  const stakes = await stakesCollection.find({ walletAddress }).toArray();

  const stakesWithEarnings = stakes.map(entry => ({
    ...entry,
    earned: calculateEarnings(entry)
  }));

  res.json(stakesWithEarnings);
});

app.get('/api/sglcn-xau/history', async (req, res) => {
  try {
    // Fetch recent data, e.g. last 7 days, limit 1000
    const data = await SGLCNXAUPrice.find({})
      .sort({ timestamp: 1 }) // oldest to newest
      .limit(1000)
      .lean();

    res.json(data);
  } catch (err) {
    console.error('Failed to fetch history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Call the XRPL ping when the server starts
xrplPing().then(() => {
  console.log("XRPL network connection check complete.");
});

xumm.ping().then(response => {
    console.log("XUMM connection successful", response);
}).catch(error => {
    console.error("Error connecting to XUMM:", error);
});

console.log(requireLogin.session); // Log session data to verify its content


// Run the cleanup job periodically (every 48 hours for example)
setInterval(cleanupExpiredPayloads, 48 * 60 * 60 * 1000); // Every 24 hours


    
    console.log("XRPL client connected");
 // Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port ' + (process.env.PORT || 3000));
});
