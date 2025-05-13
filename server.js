// ===== Imports =====
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
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
import { xummApi } from './xrplClient.js';
import mime from 'mime';
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


// ===== Init App and Env =====
dotenv.config();

const xummSDK = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const SEAGULL_COIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"; // Issuer address
const SEAGULL_COIN_CODE = "SeagullCoin"; // Currency code
const MINT_COST = 0.5; // Cost for minting in SeagullCoin
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


const usedPayloads = new Set(); // In-memory cache to prevent reuse


const api = new RippleAPI({ server: 'wss://s2.ripple.com' });


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
      url: 'http://sglcn-x20-api.glitch.me', // Change this URL when deploying
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
app.use(cors({ origin: 'https://sglcn-x20-api.glitch.me', credentials: true }));
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



router.get('/mint-history/:wallet', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  
  const { wallet } = req.params;
  db.all(`SELECT * FROM minted_nfts WHERE wallet = ? ORDER BY id DESC`, [wallet], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    res.json({ success: true, nfts: rows });
  });
});


app.post('/send-message',
  body('recipient').isString().isLength({ min: 25 }).withMessage('Invalid recipient address'),
  body('message').isString().isLength({ min: 1, max: 500 }).withMessage('Message must be between 1 and 500 characters'),
  async (req, res) => {
    console.log('Received request:', req.body);  // Debugging

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());  // Debugging
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipient, message } = req.body;

    // Assuming user is authenticated and their wallet address is stored in session or JWT token
    const sender = req.user.walletAddress;  // Example: retrieve sender dynamically

    if (!sender) {
      return res.status(401).json({ error: 'Sender not authenticated' });
    }

    // Insert the message into the database
    const stmt = db.prepare('INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?)');
    stmt.run(sender, recipient, message, function (err) {
      if (err) {
        return res.status(500).send('Error sending message');
      }
      res.status(200).json({
        id: this.lastID,
        sender,
        recipient,
        message,
        timestamp: new Date().toISOString()  // Or rely on the DB timestamp
      });
    });
    stmt.finalize();
  }
);

/**
 * @swagger
 * /send-message:
 *   post:
 *     summary: Send a message to the community board
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletAddress:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 */// ===== Get Messages Route =====
app.get('/get-messages', async (req, res) => {
  const { walletAddress, page = 1, limit = 20 } = req.query;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address is required.' });
  }

  const offset = (page - 1) * limit;

  try {
    // Prepare the SQL query to get all messages where the wallet is either the sender or recipient
    const query = `SELECT * FROM messages WHERE sender = ? OR recipient = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

    // Execute the query and return messages
    db.all(query, [walletAddress, walletAddress, limit, offset], (err, rows) => {
      if (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json({ error: 'Failed to fetch messages.' });
      }

      res.json({ success: true, messages: rows });
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});/**
 * @swagger
 * /get-messages:
 *   get:
 *     summary: Get all messages from the community board
 *     parameters:
 *       - in: query
 *         name: walletAddress
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 */
// ===== Health Check =====
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
app.get('/check-login', async (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) return res.status(400).json({ error: 'Missing UUID' });

  try {
    const payload = await xumm.payload.get(uuid);
    if (payload.meta.signed && payload.response.account) {
      res.json({
        loggedIn: true,
        account: payload.response.account,
        uuid
      });
    } else {
      res.json({ loggedIn: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error checking login' });
  }
});



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

app.post('/pay', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "Missing wallet address" });

  try {
    await client.connect();

    // Check trustline
    const lines = await client.request({
      command: "account_lines",
      account: walletAddress,
    });

    const hasTrustline = lines.result.lines.some(
      line => line.currency === SEAGULL_COIN_LABEL && line.issuer === SEAGULL_COIN_ISSUER
    );

    if (!hasTrustline) {
      return res.status(403).json({ error: "Missing SeagullCoin trustline" });
    }

    // Check recent payments
    const txs = await client.request({
      command: "account_tx",
      account: walletAddress,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 10,
    });

    const payment = txs.result.transactions.find(tx =>
      tx.tx.TransactionType === "Payment" &&
      tx.tx.Destination === SERVICE_WALLET &&
      tx.tx.Amount.currency === SEAGULL_COIN_LABEL &&
      tx.tx.Amount.issuer === SEAGULL_COIN_ISSUER &&
      parseFloat(tx.tx.Amount.value) >= MINT_COST
    );

    if (!payment) {
      return res.status(402).json({ error: "Payment of 0.5 SeagullCoin not found" });
    }

    return res.json({ success: true, txHash: payment.tx.hash });

  } catch (err) {
    console.error("Payment check failed:", err.message);
    res.status(500).json({ error: "Payment verification failed" });
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
});

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
app.get('/collections', async (req, res) => {
  try {
    const collections = await getAllCollections(); // Function to fetch all collections
    res.json({ collections });
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ error: 'Failed to fetch collections.' });
  }
});
/**
 * @swagger
 * /collections:
 *   get:
 *     summary: Get public NFT collections
 *     responses:
 *       200:
 *         description: Public collections retrieved
 */


// Get all collections
app.get('/getallcollections', async (req, res) => {
  db.all("SELECT * FROM collections", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

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
});

// Endpoint to initiate the authentication
app.get('/authenticate', async (req, res) => {
  try {
    const payload = {
      "TransactionType": "SignIn",
      "Destination": "https://sglcn-x20-api.glitch.me/login",
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




// Helper to convert hex-encoded URI to UTF-8 string
function hexToUtf8(hex) {
  if (!hex || typeof hex !== 'string') return '';
  try {
    return Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
  } catch (e) {
    console.error('Invalid hex string:', hex);
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
    try {
      const res = await fetchWithTimeout(gatewayUrl + ipfsUrl.replace('ipfs://', ''), {}, 10000);  // 10 seconds
      if (res.ok) {
        metadata = await res.json();
      }
    } catch (err) {
      console.warn(`Retry attempt ${attempt + 1} failed with gateway ${gatewayUrl}: ${err.message}`);
    }
    attempt++;
  }

  return metadata;
};

// Test route to fetch NFTs for a wallet (limit to 20 NFTs)
app.get('/nfts/:wallet', async (req, res) => {
  const wallet = req.params.wallet;

  // Check cache
  const cached = nftCache.get(wallet);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return res.json({ nfts: cached.data });
  }

  try {
    const rawNFTs = await fetchAllNFTs(wallet);

    const parsed = await Promise.all(rawNFTs.map(async (nft) => {
      const uri = hexToUtf8(nft.URI);
      let metadata = null, collection = null, icon = null;

      if (uri.startsWith('ipfs://')) {
        const ipfsUrl = uri.replace('ipfs://', '');
        try {
          // Fetch metadata with retry mechanism
          metadata = await fetchMetadataWithRetry(ipfsUrl);
          if (metadata) {
            collection = metadata.collection || metadata.name || null;
            icon = metadata.image || null;
          }
        } catch (err) {
          console.warn(`IPFS fetch failed for ${nft.NFTokenID}: ${err.message}`);
        }
      }

      return {
        NFTokenID: nft.NFTokenID,
        URI: uri,
        collection,
        icon,
        metadata
      };
    }));

    // Cache the result
    nftCache.set(wallet, { data: parsed, timestamp: Date.now() });

    res.json({ nfts: parsed });
  } catch (err) {
    console.error('NFT fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch NFTs' });
  }
});

// Helper to fetch all NFTs for a wallet with proper caching
async function fetchAllNFTs(wallet) {
  let allNFTs = [];
  let marker = null;

  try {
    do {
      const requestBody = {
        method: 'account_nfts',
        params: [{
          account: wallet,
          ledger_index: 'validated',
          ...(marker && { marker })
        }]
      };

      const response = await fetch(xrplApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.result?.error) {
        throw new Error(data.result.error_message);
      }

      allNFTs.push(...(data.result.account_nfts || []));
      marker = data.result.marker || null;

    } while (marker);

    // Cache full result
    nftCache.set(wallet, { data: allNFTs, timestamp: Date.now() });
    return allNFTs;

  } catch (error) {
    console.error('Error fetching NFTs:', error);
    throw new Error('Failed to fetch NFTs');
  }
}




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
        currency: '53656167756C6C436F696E000000000000000000', // SeagullCoin (Hex code)
        issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno', // SeagullCoin issuer
        value: price.toString(), // Make sure to convert price to a string
      },
      Flags: 1, // Ensure you're setting the correct flag for selling
    };

    // XUMM payload creation
    const payload = {
      txjson: tx,
      options: {
        submit: true, // Automatically submit the transaction after signing
        expire: 60, // Expiration time for the offer (in seconds)
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


const createTrustline = async (walletAddress) => {
  const trustlineTx = {
    TransactionType: 'TrustSet',
    Account: walletAddress,
    LimitAmount: {
      currency: '53656167756C6C436F696E000000000000000000', // SeagullCoin currency code (hex)
      issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno', // SeagullCoin issuer
      value: '587000000', // Set a limit on how much SeagullCoin the wallet can hold
    },
  };

  const payload = {
    txjson: trustlineTx,
    options: {
      submit: true,
      expire: 60,
    },
  };

  try {
    const { uuid, next } = await xumm.payload.create(payload);
    console.log('Trustline Payload Created:', next);
    return { uuid, next };
  } catch (err) {
    console.error('Error creating trustline:', err);
    return { error: 'Failed to create trustline' };
  }
};




app.post('/buy-nft', async (req, res) => {
  const { walletAddress, nftId, price } = req.body;

  if (!walletAddress || !nftId || !price) {
    return res.status(400).json({ error: 'Missing walletAddress, nftId, or price' });
  }

  try {
    const tx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: walletAddress,
      NFTokenID: nftId,
      Amount: {
        currency: '53656167756C6C436F696E000000000000000000', // SeagullCoin (hex)
        issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
        value: price.toString(), // amount of SGLCN offered
      },
      Flags: 0 // Buy offer (not sell)
    };

    const payload = {
      txjson: tx,
      options: {
        submit: true,
        expire: 60,
      }
    };

    const { uuid, next } = await xumm.payload.create(payload);
    return res.json({ next, uuid });
  } catch (err) {
    console.error('Buy NFT error:', err?.data ?? err);
    return res.status(500).json({ error: 'Failed to create buy offer' });
  }
});

const checkTrustline = async (walletAddress) => {
  const response = await xrplClient.request({
    method: "account_lines",
    params: [
      {
        account: walletAddress,
      },
    ],
  });
  
  const trustlines = response.result.lines;
  const seagullCoinTrustline = trustlines.find(
    (line) => line.account === "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno" && line.currency === "53656167756C6C436F696E000000000000000000"
  );
  
  return seagullCoinTrustline;
};


app.post('/accept-sell-offer', async (req, res) => {
  const { walletAddress, sellOfferId } = req.body;

  if (!walletAddress || !sellOfferId) {
    return res.status(400).json({ error: 'Missing walletAddress or sellOfferId' });
  }

  try {
    const tx = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: walletAddress,
      NFTokenSellOffer: sellOfferId
    };

    const payload = {
      txjson: tx,
      options: {
        submit: true,
        expire: 60,
      }
    };

    const { uuid, next } = await xumm.payload.create(payload);
    return res.json({ next, uuid });
  } catch (err) {
    console.error('Accept Sell Offer error:', err?.data ?? err);
    return res.status(500).json({ error: 'Failed to accept sell offer' });
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

const walletAddress = 'rEXAMPLEOWNER'; // Replace with an actual wallet address



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
    const res = await fetch(`https://sglcn-x20-api.glitch.me/active-offers/${wallet}`);
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

  const res = await fetch("https://sglcn-x20-api.glitch.me/cancel-offer", {
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



// Payment route
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

  const trustline = await hasSeagullCoinTrustline(wallet, client);
  if (!trustline) {
    return res.status(400).json({ error: 'Missing SeagullCoin trustline' });
  }

  const payload = {
    txjson: {
      TransactionType: 'Payment',
      Destination: SERVICE_WALLET,
      Amount: {
        currency: SEAGULLCOIN_HEX,
        issuer: SEAGULLCOIN_ISSUER,
        value: "0.5"
      }
    },
    options: {
      submit: true,
      return_url: {
        web: "https://outgoing-destiny-bladder.glitch.me/success.html",
        app: "https://outgoing-destiny-bladder.glitch.me/success.html"
      }
    }
  };

  try {
    const created = await xumm.payload.createAndSubscribe(payload, event => {
      if (event.data.signed === true) {
        console.log("Payment signed by", wallet);
        return true;
      }
      if (event.data.signed === false) {
        console.log("Payment declined by", wallet);
        return false;
      }
    });

    // Track status
    payments[created.uuid] = {
      wallet,
      paid: false
    };

    created.resolved.then(resolved => {
      if (resolved.signed) {
        payments[created.uuid].paid = true;
      } else {
        delete payments[created.uuid];
      }
    });

    res.json({
      uuid: created.uuid,
      next: created.next
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});




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

// Endpoint to get active offers for a wallet
app.get('/active-offers/:walletAddress', async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const offersData = await fetchOffersFromXRPL(walletAddress);

    // Return response with filtered offers
    res.json({
      wallet: walletAddress,
      sellOffers: offersData.offers || [],  // If offers are present, include them, else return empty array
      buyOffers: []  // Add logic for buy offers if necessary
    });
  } catch (error) {
    console.error('Error fetching active offers:', error);
    res.status(500).json({ error: 'Failed to fetch active offers' });
  }
});

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


// Run the cleanup job periodically (every 24 hours for example)
setInterval(cleanupExpiredPayloads, 24 * 60 * 60 * 1000); // Every 24 hours


    
    console.log("XRPL client connected");
 // Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port ' + (process.env.PORT || 3000));
}); 