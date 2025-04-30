// ===== Imports and Config =====
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

import { mintNFT, verifySeagullCoinPayment, rejectXRPOffer } from './mintingLogic.js';
import { client, fetchNFTs } from './xrplClient.js';
import { addListing, getNFTDetails, unlistNFT, getAllNFTListings } from './nftListings.js';
import { OfferModel } from './models/offerModel.js'; // Fix here: Importing the OfferModel only once

// ===== Init App and Env =====
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Connect to MongoDB and Start Server
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
})();

// ===== Config =====
dotenv.config();

const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI, SGLCN_ISSUER, SERVICE_WALLET } = process.env;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===== Rate limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

// Middleware
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

// Quick reject XRP offers right after minting
async function rejectOffersImmediately(nftokenId) {
  const offers = await OfferModel.find({ nftokenId });
  for (let offer of offers) {
    await rejectXRPOffer(offer.offerIndex);  // Call to reject offer
  }
}

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

    // Immediately reject XRP offers after minting
    await rejectOffersImmediately(mintResult.nftokenId);

    res.json({ success: true, mintResult });
  } catch (err) {
    console.error('Minting error:', err);
    res.status(500).json({ error: 'Minting failed.', message: err.message });
  }
});

// ===== Background Offer Cleanup (every 30 seconds) =====
setInterval(async () => {
  console.log('Checking for unauthorized offers...');
  const offers = await OfferModel.find({ flags: { $ne: 0 } });  // Non-zero flags are unauthorized offers
  for (let offer of offers) {
    await rejectXRPOffer(offer.offerIndex);  // Reject the unauthorized offer
  }
}, 30000);  // 30 seconds interval

// ===== Root Route =====
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the SGLCN-X20 Minting API. Visit /api-docs for documentation.' });
});

// ======= XUMM OAuth =======
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

// ===== Multer Upload Setup =======
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

app.listen(port, () => {
  console.log(`SGLCN-X20 Minting API running on port ${port}`);
});
