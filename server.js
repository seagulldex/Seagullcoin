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
import { acceptOffer, rejectOffer } from './mintingLogic.js';
import { body, query, validationResult } from 'express-validator';
import { XummSdk } from 'xumm-sdk';
import { requireLogin } from './middleware.js'
import { verifyXummPayload, createNftOfferPayload } from './xumm-utils.js'
import { createNftOffer } from './xrpl-utils.js'
import { Profile } from './profile.js'; // Adjust path to your models directory if needed
import pkg from 'xumm-sdk';




// Import your business logic modules
import { client, fetchNFTs } from './xrplClient.js';
import { addListing, getNFTDetails, unlistNFT, getAllNFTListings } from './nftListings.js';
import { OfferModel } from './models/offerModel.js';
import { NFTModel } from './models/nftModel.js';  // Added a new model for NFT management
import { MongoClient, ServerApiVersion } from 'mongodb';

// ===== Init App and Env =====
dotenv.config();

const sdk = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const SEAGULL_COIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"; // Issuer address
const SEAGULL_COIN_CODE = "SeagullCoin"; // Currency code
const MINT_COST = 0.5; // Cost for minting in SeagullCoin
const SEAGULL_COIN_LABEL = "SGLCN"; // Token identifier (SeagullCoin trustline)
const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);


const app = express();
const port = process.env.PORT || 3000;
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI, SGLCN_ISSUER, SERVICE_WALLET } = process.env;
const db = new sqlite3.Database('./database.db');
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });



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

// ===== Multer Setup =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);  // Set file destination to the uploads directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));  // Create a unique filename
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },  // Limit file size to 10MB
}).single('file');  // Expect a single file to be uploaded with the field name 'file'

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Rate Limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

// ===== Middleware =====
app.use(limiter);
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send("Root endpoint is working!");
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
};


  // Insert a test user
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

// ===== Send Message Route ======
// XUMM OAuth login route
app.post('/login', async (req, res) => {
  const { xummPayload } = req.body;
  try {
    // Verify XUMM payload to fetch wallet address
    const response = await verifyXummPayload(xummPayload);  // Corrected here
    if (!response.success) {
      return res.status(401).json({ error: 'Invalid wallet' });
    }

    // Store wallet address in session
    req.session.walletAddress = response.walletAddress;
    res.status(200).json({ message: 'Logged in successfully' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error logging in' });
  }
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
});

/**
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
        const payload = await sdk.payload.create({
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
});

// ===== Minting Route =====
async function mintNFT(walletAddress, name, description, imageUri) {
  try {
    const transaction = {
      "TransactionType": "NFTokenMint",
      "Account": walletAddress,
      "URI": imageUri,  // Store the IPFS metadata URL here
      "Flags": 131072,  // Set the flags for minting (e.g., prevent secondary sales)
    };

    const preparedTx = await client.autofill(transaction);
    const signedTx = client.sign(preparedTx, walletAddress); // Ensure you sign with the correct wallet's private key
    const txResult = await client.submit(signedTx.tx_blob);

    if (txResult.resultCode === "tesSUCCESS") {
      console.log('NFT minted successfully!');

      // Log the mint transaction
      logTransaction(walletAddress, name, 'mint', MINT_COST, 'success', txResult.tx_json.hash);
    } else {
      throw new Error('NFT minting failed.');
    }
  } catch (error) {
    console.error('Error in minting NFT:', error);

    // Log the failed mint transaction
    logTransaction(walletAddress, name, 'mint', MINT_COST, 'failed', null);
    throw error;
  }
}

app.post('/mint', upload, async (req, res) => {
  const { walletAddress, name, description } = req.body;

  // Validate input
  if (!walletAddress || !name || !description || !req.file) {
    console.error('Missing required fields: walletAddress, name, description, or file.');
    return res.status(400).json({ error: 'Wallet address, name, description, and file are required.' });
  }

  // Debugging: log the file upload
  console.log('File uploaded:', req.file);  // Check if the file is being uploaded properly

  try {
    if (!client.isConnected()) await client.connect();

    // Step 1: Check SeagullCoin balance for minting
    const accountLines = await client.request({
      method: 'account_lines',
      params: [{ account: walletAddress }],
    });

    const line = accountLines.result.lines.find(l =>
      l.currency === SEAGULL_COIN_CODE && l.issuer === SEAGULL_COIN_ISSUER
    );

    const balance = line ? parseFloat(line.balance) : 0;

    if (balance < MINT_COST) {
      return res.status(400).json({ error: 'Insufficient SeagullCoin balance for minting.' });
    }

    // Step 2: Create XUMM payment transaction for 0.5 SeagullCoin
    const xummPayload = {
      "TransactionType": "Payment",
      "Account": walletAddress,
      "Amount": MINT_COST * 1000000,  // Convert SeagullCoin to drops
      "Destination": SERVICE_WALLET,  // Send to service wallet
      "Currency": SEAGULL_COIN_CODE,
      "Issuer": SEAGULL_COIN_ISSUER,
      "DestinationTag": 0,
    };

    const xummTx = await xumm.payload.create({ txjson: xummPayload });

    // Step 3: Send user to XUMM to sign the transaction
    const txRequestUrl = `https://xumm.app/sign/${xummTx.data.uuid}`;
    return res.status(200).json({
      message: 'Sign the transaction to proceed with minting.',
      xummUrl: txRequestUrl,  // Direct user to the XUMM sign request URL
    });

  } catch (error) {
    console.error('Error during minting process:', error);
    return res.status(500).json({ error: 'Error during minting process.', details: error.message });
  }
});

/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint a new NFT
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nft_file:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: NFT minted successfully
 */


// ===== Listing NFT Route =====


app.post('/login', async (req, res) => {
  const { xummPayload } = req.body;

  try {
    const verifiedPayload = await verifyXummPayload(xummPayload);

    if (verifiedPayload) {
      const walletAddress = verifiedPayload.account;

      // Set session variable for the user
      req.session.walletAddress = walletAddress;

      res.status(200).json({ success: true, message: 'User authenticated', walletAddress });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: 'Payload verification failed' });
  }
});
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
app.post('/api/list-nft', async (req, res) => {
  // list-nft logic here
});// Remove duplicate route definitions

// Example route for creating an NFT offer
app.post('/create-nft-offer', async (req, res) => {
  const { walletAddress, nftokenID, amount } = req.body;

  try {
    // Call the async function to create the NFT offer
    const nftOfferResponse = await createNftOfferPayload(walletAddress, nftokenID, amount, true);
    console.log(nftOfferResponse); // Log the resolved response

    // Send the response back to the client
    res.json(nftOfferResponse); 
  } catch (error) {
    console.error('Error creating NFT offer:', error);
    res.status(500).json({ error: 'Failed to create NFT offer' });
  }
});

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
}

app.post('/buy-nft', async (req, res) => {
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
});

/**
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

// List an NFT for sale

// Example logic for listing an NFT for sale
async function listNFTForSale(nftId, sellerAddress, price) {
  // Add your logic here, e.g.:
  // - Validate NFT ownership
  // - Insert or update a listing record in your database
  // - Interact with XRPL to create an NFTokenOffer

  console.log(`Listing NFT ${nftId} by ${sellerAddress} for ${price} SeagullCoin`);

  // Mock result
  return { success: true, message: 'NFT listed for sale' };
}

// Transfer SeagullCoin function
async function transferSeagullCoin(fromAddress, toAddress, amount) {
  try {
    const transaction = {
      "TransactionType": "Payment",
      "Account": fromAddress,
      "Destination": toAddress,
      "Amount": client.xrpToDrops(amount),  // Convert SeagullCoin amount to drops
      "Currency": SEAGULL_COIN_CODE, // SeagullCoin currency code
      "Issuer": SEAGULL_COIN_ISSUER,  // SeagullCoin issuer address
    };

    const preparedTx = await client.autofill(transaction);
    const signedTx = client.sign(preparedTx, fromAddress);  // Sign with buyer's private key
    const txResult = await client.submit(signedTx.tx_blob);

    if (txResult.resultCode === "tesSUCCESS") {
      return { success: true, transactionHash: txResult.tx_json.hash };
    } else {
      throw new Error('SeagullCoin transfer failed.');
    }
  } catch (error) {
    console.error('Error transferring SeagullCoin:', error);
    return { success: false, error: error.message };
  }
}// Transfer NFT function
async function transferNFT(nftId, fromAddress, toAddress) {
  try {
    const transaction = {
      "TransactionType": "NFTokenTransfer",
      "Account": fromAddress,
      "TokenID": nftId, // The ID of the NFT to transfer
      "Destination": toAddress,
      "Flags": 0, // Optional flags; modify as needed for your use case
    };

    const preparedTx = await client.autofill(transaction);
    const signedTx = client.sign(preparedTx, fromAddress);  // Sign with seller's private key
    const txResult = await client.submit(signedTx.tx_blob);

    if (txResult.resultCode === "tesSUCCESS") {
      return { success: true, transactionHash: txResult.tx_json.hash };
    } else {
      throw new Error('NFT transfer failed.');
    }
  } catch (error) {
    console.error('Error transferring NFT:', error);
    return { success: false, error: error.message };
  }
}

// The /sell-nft endpoint
app.post('/sell-nft', async (req, res) => {
  const { userAddress, nftId, price, buyerAddress } = req.body;
  
  try {
    // Verify that the user owns the NFT
    const nft = await NFTModel.findById(nftId);
    if (!nft || nft.walletAddress !== userAddress) {
      return res.status(400).json({ error: 'You do not own this NFT.' });
    }

    // 1. Simulate transferring SeagullCoin from the buyer to the seller
    const transferResult = await transferSeagullCoin(buyerAddress, userAddress, price);
    if (!transferResult.success) {
      return res.status(500).json({ error: 'Failed to process payment: ' + transferResult.error });
    }

    // 2. Simulate transferring the NFT from the seller to the buyer
    const transferNFTResult = await transferNFT(nftId, userAddress, buyerAddress);
    if (!transferNFTResult.success) {
      return res.status(500).json({ error: 'Failed to transfer NFT: ' + transferNFTResult.error });
    }

    // Log the successful sell transaction
    logTransaction(userAddress, nftId, 'sell', price, 'success');

    res.status(200).json({ message: 'NFT successfully sold.' });
  } catch (error) {
    console.error('Error selling NFT:', error);
    
    // Log the failed sell transaction
    logTransaction(userAddress, nftId, 'sell', price, 'failed');

    res.status(500).json({ error: 'Failed to sell NFT.' });
  }
});



/**
 * @swagger
 * /sell-nft:
 *   post:
 *     summary: List an NFT for sale
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftokenId:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: NFT listed for sale
 */

// Burn NFT Logic
async function burnNFT(walletAddress, nftTokenID) {
  try {
    const transaction = {
      "TransactionType": "NFTokenBurn",
      "Account": walletAddress,
      "NFTokenID": nftTokenID,  // The ID of the NFT you want to burn
    };

    const preparedTx = await client.autofill(transaction);  // Prepare the transaction
    const signedTx = client.sign(preparedTx, walletAddress);  // Sign the transaction with wallet address
    const txResult = await client.submit(signedTx.tx_blob);  // Submit the transaction to XRPL

    if (txResult.resultCode === "tesSUCCESS") {
      console.log('NFT burned successfully!');
      return true;
    } else {
      throw new Error('NFT burning failed.');
    }
  } catch (error) {
    console.error('Error in burning NFT:', error);
    throw error;
  }
}

// Burn NFT route
app.post('/burn', async (req, res) => {
  const { nftokenId } = req.body;
  const { walletAddress } = req.session;  // Get the wallet address from session (or another method)

  if (!nftokenId || !walletAddress) {
    return res.status(400).json({ error: 'NFT ID and wallet address are required for burning.' });
  }

  try {
    const burnResult = await burnNFT(walletAddress, nftokenId);  // Pass both wallet address and NFT token ID
    if (burnResult) {
      return res.json({ success: true, message: `NFT with ID ${nftokenId} successfully burned.` });
    } else {
      return res.status(500).json({ error: 'Failed to burn NFT.' });
    }
  } catch (err) {
    console.error('Burning error:', err);
    res.status(500).json({ error: 'Failed to burn NFT.', message: err.message });
  }
});

/**
 * @swagger
 * /burn:
 *   post:
 *     summary: Burn an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftokenId:
 *                 type: string
 *     responses:
 *       200:
 *         description: NFT burned successfully
 */

// Get NFT details by NFT token ID
app.get('/nft/:nftokenId', async (req, res) => {
  const { nftokenId } = req.params;
  try {
    const nftDetails = await getNFTDetails(nftokenId);
    res.json({ nftDetails });
  } catch (err) {
    console.error('NFT details error:', err);
    res.status(500).json({ error: 'Failed to retrieve NFT details.', message: err.message });
  }
});

// Get NFT details by DB ID
app.get('/api/nft/:id', async (req, res) => {
  // TODO: Add get-nft-by-id logic here
});

/**
 * @swagger
 * /api/nft/{id}:
 *   get:
 *     summary: Get details of an NFT by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the NFT
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: NFT details retrieved successfully
 */
async function getTransactionHistory(walletAddress) {
  const response = await fetch(`https://xumm.app/api/v1/account/${walletAddress}/transactions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${XUMM_API_KEY}`,
    },
  });if (!response.ok) throw new Error('Failed to fetch transaction history from XUMM');

  const data = await response.json();
  return data.transactions;
}


app.patch('/api/profile/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  const { name, bio, socials, links, collectionCount, nftCount, banner, avatar } = req.body;
  const sql = `
    UPDATE users
    SET name = ?, bio = ?, socials = ?, links = ?, collectionCount = ?, nftCount = ?, banner = ?, avatar = ?
    WHERE wallet = ?
  `;
  const params = [
    name || '', bio || '', JSON.stringify(socials || {}), JSON.stringify(links || {}),
    collectionCount || 0, nftCount || 0, banner || '', avatar || '', wallet
  ];
  db.run(sql, params, function (err) {
    if (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Database error' });
    } else {
      res.json({ success: true });
    }
  });
});


// Get user profile information by wallet address
app.get('/api/profile/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    
    // Fetch the profile data from the database using the wallet address
    const profile = await Profile.findOne({ where: { walletAddress: wallet } });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Send the profile data as a response
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/transaction-history', (req, res) => {
    const userAddress = req.query.userAddress;  // Assume the user address is passed in the query
    db.all('SELECT * FROM transactions WHERE user_address = ?', [userAddress], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
/**
 * @swagger
 * /transaction-history:
 *   get:
 *     summary: Get all transactions for a wallet address.
 *     description: Fetch the transaction history (mint, buy, sell, transfer) for a given wallet address.
 *     parameters:
 *       - in: query
 *         name: walletAddress
 *         required: true
 *         description: The wallet address for which the transaction history is fetched.
 *     responses:
 *       200:
 *         description: A list of transactions for the wallet address.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   transactionType:
 *                     type: string
 *                     description: The type of the transaction (mint, buy, sell, transfer).
 *                   amount:
 *                     type: number
 *                     description: The amount involved in the transaction.
 *                   status:
 *                     type: string
 *                     description: The status of the transaction (success, failed).
 *                   transactionHash:
 *                     type: string
 *                     description: The transaction hash of the transaction.
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     description: The timestamp of when the transaction occurred.
 *       400:
 *         description: Invalid wallet address or missing wallet address parameter.
 *       500:
 *         description: Internal server error.
 */

// Update profile picture
app.post('/update-profile-picture', async (req, res) => {
  const { walletAddress } = req.session;
  const profilePic = req.file;

  if (!profilePic) return res.status(400).json({ error: 'Profile picture is required.' });

  try {
    const ipfsResult = await nftStorage.store({ file: profilePic.path });
    const profilePicUrl = ipfsResult.url;
    await updateUserProfile(walletAddress, { profilePicUrl });
    res.json({ success: true, profilePicUrl });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile picture.', message: err.message });
  }
});/**
 * @swagger
 * /update-profile-picture:
 *   post:
 *     summary: Update profile picture
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
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
}

app.post('/update-username', async (req, res) => {
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
}// Insert new

// Like NFT endpoint
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
      });

      // Return the success result to the client
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
  }
  
);

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

xumm.ping().then(response => {
    console.log("XUMM connection successful", response);
}).catch(error => {
    console.error("Error connecting to XUMM:", error);
});


// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port ' + (process.env.PORT || 3000));
}); 