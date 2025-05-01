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
import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import { fetchSeagullCoinBalance } from './xrplClient.js'; // adjust path if needed
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { getTotalNFTs, getMostLikedNFTs, getTotalUsers, getTotalMints } from './dbHelpers.js';
import { createTables } from './dbSetup.js';
import { acceptOffer, rejectOffer } from './mintingLogic.js';


// Import your business logic modules
import { mintNFT, verifySeagullCoinPayment, rejectXRPOffer, burnNFTLogic } from './mintingLogic.js';
import { client, fetchNFTs } from './xrplClient.js';
import { addListing, getNFTDetails, unlistNFT, getAllNFTListings } from './nftListings.js';
import { OfferModel } from './models/offerModel.js';
import { NFTModel } from './models/nftModel.js';  // Added a new model for NFT management
import { MongoClient, ServerApiVersion } from 'mongodb';

// ===== Init App and Env =====
dotenv.config();




const app = express();
const port = process.env.PORT || 3000;
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI, SGLCN_ISSUER, SERVICE_WALLET } = process.env;

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database.');
    createTables(db);
  }
});

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===== Multer Upload Setup =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

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


// ===== Swagger Docs =====
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ===== SQLite Init =====
// Initialize SQLite database

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

// ===== Send Message Route =====
app.post('/send-message', async (req, res) => {
  const { sender, recipient, messageContent } = req.body;

  // Validate input
  if (!sender || !recipient || !messageContent) {
    return res.status(400).json({ error: 'Sender, recipient, and message content are required.' });
  }

  try {
    // Prepare the SQL query to insert a new message
    const query = `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?)`;
    
    // Insert the message into the database
    db.run(query, [sender, recipient, messageContent], function (err) {
      if (err) {
        console.error('Error sending message:', err);
        return res.status(500).json({ error: 'Failed to send message.' });
      }
      
      res.json({ success: true, message: 'Message sent successfully.' });
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

db.run(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

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
 */


// ===== Get Messages Route =====
app.get('/get-messages', async (req, res) => {
  const { walletAddress } = req.query;

  // Validate input
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address is required.' });
  }

  try {
    // Prepare the SQL query to get all messages where the wallet is either the sender or recipient
    const query = `SELECT * FROM messages WHERE sender = ? OR recipient = ? ORDER BY timestamp DESC`;

    // Execute the query and return messages
    db.all(query, [walletAddress, walletAddress], (err, rows) => {
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

// ===== Minting Route =====
app.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;
  const nft_file = req.file;

  try {
    if (!nft_name || !nft_description || !nft_file) {
      return res.status(400).json({ error: 'NFT name, description, and file are required.' });
    }

    const paymentValid = await verifySeagullCoinPayment(req.session.xumm);
    if (!paymentValid) {
      return res.status(402).json({ error: '0.5 SeagullCoin payment required before minting.' });
    }

    const metadata = {
      name: nft_name,
      description: nft_description,
      domain,
      properties: properties ? JSON.parse(properties) : {},
      file: nft_file.path,
    };

    const walletAddress = req.session.walletAddress;
    const mintResult = await mintNFT(metadata, walletAddress);

    res.json({ success: true, mintResult });
  } catch (err) {
    console.error('Minting error:', err);
    res.status(500).json({ error: 'Minting failed.', message: err.message });
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
});


// Remove duplicate route definitions

// Accept an offer
app.post('/accept-offer', async (req, res) => {
  const { offerId, userAddress, nftId } = req.body;

  if (!offerId || !userAddress || !nftId) {
    return res.status(400).json({ error: 'Offer ID, user address, and NFT ID are required.' });
  }

  try {
    // Accept the offer logic
    const result = await acceptOffer(offerId);
    
    // Update NFT ownership
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
  const { offerId } = req.body;

  if (!offerId) {
    return res.status(400).json({ error: 'Offer ID is required.' });
  }

  try {
    const result = await rejectOffer(offerId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error rejecting offer:', err);
    res.status(500).json({ error: 'Failed to reject offer.', message: err.message });
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
 *     responses:
 *       200:
 *         description: Offer rejected
 */

// Endpoint to reject an offer
app.post('/reject-offer', async (req, res) => {
  const { nftokenId, offerId } = req.body;

  try {
    // Logic to reject the offer
    await rejectOffer(nftokenId, offerId);

    res.json({ success: true, message: 'Offer rejected.' });
  } catch (err) {
    console.error('Error rejecting offer:', err);
    res.status(500).json({ error: 'Failed to reject the offer.' });
  }
});

// Buy NFT (using SeagullCoin)
app.post('/buynft', async (req, res) => {
    const { nftId, buyerAddress, priceInSeagullCoin } = req.body;
    // Logic to process the purchase (ensure sufficient funds, transfer ownership, etc.)
    const result = await buyNFT(nftId, buyerAddress, priceInSeagullCoin); // Replace with actual logic
    res.json(result);
});
/**
 * @swagger
 * /buynft:
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
 *               buyerAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: NFT purchased successfully
 */


// List an NFT for sale
app.post('/sell-nft', async (req, res) => {
  const { nftokenId, price } = req.body;
  const { walletAddress } = req.session;

  try {
    // Validate the ownership and price
    await listNFTForSale(nftokenId, walletAddress, price);

    res.json({ success: true, message: 'NFT listed for sale.' });
  } catch (err) {
    console.error('Error listing NFT for sale:', err);
    res.status(500).json({ error: 'Failed to list NFT for sale.' });
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



// ===== Burn NFT Route =====
app.post('/burn', async (req, res) => {
  const { nftokenId } = req.body;

  try {
    if (!nftokenId) {
      return res.status(400).json({ error: 'NFT ID is required for burning.' });
    }

    // Burn the NFT
    const burnResult = await burnNFTLogic(nftokenId);
    res.json({ success: true, message: `NFT with ID ${nftokenId} successfully burned.` });
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


// ===== Get NFT Details =====
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


app.get('/api/nft/:id', async (req, res) => {
  // get-nft-by-id logic here
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "nft-123"
 *                 name:
 *                   type: string
 *                   example: "SeagullCoin NFT"
 *                 price:
 *                   type: number
 *                   example: 0.5
 */

// Endpoint to update profile picture
app.post('/update-profile-picture', async (req, res) => {
  const { walletAddress } = req.session;
  const profilePic = req.file; // Image file uploaded

  if (!profilePic) return res.status(400).json({ error: 'Profile picture is required.' });

  try {
    // Upload image to NFT.Storage or any other service for persistence
    const ipfsResult = await nftStorage.store({ file: profilePic.path });
    const profilePicUrl = ipfsResult.url;

    // Save to user profile in your DB (or session storage)
    await updateUserProfile(walletAddress, { profilePicUrl });

app.post('/updateuserprofile', async (req, res) => {
    const { userAddress, profileData } = req.body;
    // Logic to update the user's profile in your database
    const result = await updateUserProfile(userAddress, profileData); // Replace with actual logic
    res.json(result);
});

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


// Endpoint to update username
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

// Like an NFT
app.post('/like-nft', async (req, res) => {
  const { nftokenId } = req.body;
  const { walletAddress } = req.session;

  try {
    // Handle liking an NFT (increment likes counter or save liked NFTs)
    await likeNFT(walletAddress, nftokenId);

    res.json({ success: true, message: 'NFT liked.' });
  } catch (err) {
    console.error('Error liking NFT:', err);
    res.status(500).json({ error: 'Failed to like NFT.' });
  }
});

/**
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
app.post('/api/like-nft', async (req, res) => {
  // like-nft logic here
});


app.get('/gettotalnfts', async (req, res) => {
    // Logic to get the total number of NFTs from your database
    const totalNFTs = await getTotalNFTs(); // Replace with actual logic
    res.json({ totalNFTs });
});

/**
 * @swagger
 * /api/stats/nfts:
 *   get:
 *     summary: Get total number of SeagullCoin NFTs minted
 *     responses:
 *       200:
 *         description: Total NFTs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 100
 */
app.get('/api/stats/nfts', async (req, res) => {
  // get-total-nfts logic here
});


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

// GET endpoint to retrieve messages for a user
app.get('/get-messages', async (req, res) => {
  const { walletAddress } = req.query;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address is required.' });
  }

  try {
    const query = `SELECT * FROM messages WHERE sender = ? OR recipient = ? ORDER BY timestamp DESC`;
    const messages = await db.all(query, [walletAddress, walletAddress]);

    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
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
app.get('/user-nfts', async (req, res) => {
  const { walletAddress } = req.session;

  try {
    const nfts = await getUserNFTs(walletAddress); // Function to fetch NFTs for a user
    res.json({ nfts });
  } catch (err) {
    console.error('Error fetching NFTs:', err);
    res.status(500).json({ error: 'Failed to fetch NFTs.' });
  }
});

app.get('/getusernfts', async (req, res) => {
    const { userAddress } = req.query;
    // Query your database or external service to fetch NFTs for the user
    const userNFTs = await getNFTsByUserAddress(userAddress); // Replace with actual logic
    res.json(userNFTs);
});

// Get a list of all collections
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


app.get('/getallcollections', async (req, res) => {
  // Fetch all collections from the database
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


// ===== XUMM OAuth =====
app.get('/login', (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://sglcn-x20-api.glitch.me/callback')}&state=randomstring123`;
  res.redirect(authUrl);
});
/**
 * @swagger
 * /login:
 *   get:
 *     summary: Redirect to XUMM login
 *     responses:
 *       302:
 *         description: Redirect to XUMM
 */

app.get('/xumm/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code.' });

/**
 * @swagger
 * /xumm/callback:
 *   get:
 *     summary: Handle XUMM OAuth2 callback
 *     responses:
 *       200:
 *         description: Login processed
 */

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

    if (!response.ok) throw new Error('Failed to obtain access token.');

    const data = await response.json();
    req.session.xumm = data;
    req.session.walletAddress = data.account;

    res.redirect('/');
  } catch (err) {
    console.error('XUMM OAuth callback error:', err);
    res.status(500).json({ error: 'OAuth callback processing failed.' });
  }
});




