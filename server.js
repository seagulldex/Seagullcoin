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
import sqlite3 from 'sqlite3';
const { Database } = sqlite3;

const db = new Database('./database.db');

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

// Endpoint to accept an offer
app.post('/accept-offer', async (req, res) => {
  const { nftokenId, offerId } = req.body;

  try {
    // Logic to accept the offer (e.g., transfer NFT to the buyer)
    await acceptOffer(nftokenId, offerId);

    res.json({ success: true, message: 'Offer accepted successfully.' });
  } catch (err) {
    console.error('Error accepting offer:', err);
    res.status(500).json({ error: 'Failed to accept the offer.' });
  }
});

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
app.post('/buy-nft', async (req, res) => {
  const { nftokenId, price } = req.body;
  const { walletAddress } = req.session;

  try {
    const paymentValid = await verifySeagullCoinPayment(walletAddress, price);
    if (!paymentValid) {
      return res.status(402).json({ error: 'Insufficient SeagullCoin balance.' });
    }

    // Proceed with buying logic (transfer SeagullCoin, update ownership, etc.)
    await buyNFT(nftokenId, walletAddress);

    res.json({ success: true, message: 'NFT purchased successfully.' });
  } catch (err) {
    console.error('Error purchasing NFT:', err);
    res.status(500).json({ error: 'Failed to purchase NFT.' });
  }
});

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

    res.json({ success: true, profilePicUrl });
  } catch (err) {
    console.error('Error updating profile picture:', err);
    res.status(500).json({ error: 'Failed to update profile picture.' });
  }
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



// ===== XUMM OAuth =====
app.get('/login', (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://sglcn-x20-api.glitch.me/callback')}&state=randomstring123`;
  res.redirect(authUrl);
});

app.get('/xumm/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code.' });

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