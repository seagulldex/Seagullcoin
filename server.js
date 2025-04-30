// ===== Imports =====
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { mintNFT, verifySeagullCoinPayment, verifySeagullCoinTransaction, transferNFT } from './mintingLogic.js'; 
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { NFTStorage, File } from 'nft.storage'; 
import { client, fetchNFTs } from './xrplClient.js'; // Named import
import xrpl from 'xrpl';
import { addListing, getNFTDetails, unlistNFT, getAllNFTListings } from './nftListings.js';
import NftModel from './models/nftModel.js';  // Correct single import
import OfferModel from './models/offerModel.js';
import mongoose from 'mongoose';

// At the top of your server.js
const NodeCache = require('node-cache');
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });  // Cache for 10 minutes

// ===== Config =====
dotenv.config();

const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI, SGLCN_ISSUER, SERVICE_WALLET } = process.env;

const offerSchema = new mongoose.Schema({
  nftokenId: { type: String, required: true },
  offerIndex: { type: String, required: true },
  amount: { type: String, required: true },
  destination: { type: String }, // optional
  flags: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

// You can name it whatever you want, 'OfferModel' is standard.
const OfferModel = mongoose.model('Offer', offerSchema);

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Inside an async function
async function getOffers(yourTokenId) {
  const offers = await OfferModel.find({ tokenId: yourTokenId });
  return offers;
}

const app = express();

// Rate limiting middleware
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
  secret: process.env.SESSION_SECRET,  // Was "sglcn_secret_session"
  resave: false,
  saveUninitialized: true,
}));


// ===== Static Files =====
app.use(express.static(path.join(__dirname, 'public')));

// ====== API Routes ======
const apiRouter = express.Router();

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
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

app.get('/test-nft/:id', async (req, res) => {
  const nftId = req.params.id;
  try {
    const details = await getNFTDetails(nftId);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NFT details', message: err.message });
  }
});

async function getUserNFTs(walletAddress) {
  return [];  // Placeholder for actual logic
}

// Example of pagination for /nfts
app.get('/nfts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // Default page to 1
  const limit = parseInt(req.query.limit) || 20;  // Default limit to 20

  const skip = (page - 1) * limit;

  try {
    const nfts = await NftModel.find()
      .skip(skip)
      .limit(limit)
      .exec();
    
    res.json(nfts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// Example of pagination for /user-offers
app.get('/user-offers', async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // Default page to 1
  const limit = parseInt(req.query.limit) || 20;  // Default limit to 20

  const skip = (page - 1) * limit;

  try {
    const offers = await OfferModel.find({ userId: req.query.userId })
      .skip(skip)
      .limit(limit)
      .exec();
    
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// ===== Root Route =====
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the SGLCN-X20 Minting API. Visit /api-docs for documentation.' });
});

// ======= XUMM OAuth =======
apiRouter.get('/login/start', (req, res) => {
  res.json({ message: 'Use /api/login to start XUMM OAuth2 login flow.' });
});

apiRouter.get('/login', (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://sglcn-x20-api.glitch.me/callback')}&state=randomstring123`;
  res.redirect(authUrl);
});

apiRouter.get('/xumm/callback', async (req, res) => {
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

apiRouter.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out.' });
    }
    res.redirect('/');
  });
});

// ======= Check Login State =======
apiRouter.get('/login/check', (req, res) => {
  if (req.session.xumm) {
    res.json({ loggedIn: true, walletAddress: req.session.walletAddress });
  } else {
    res.json({ loggedIn: false });
  }
});

// ======= Multer Upload Setup =======
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ======= NFT Minting =======
apiRouter.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;
  const nft_file = req.file;

  try {
    if (!nft_name || !nft_description || !nft_file) {
      return res.status(400).json({ error: 'NFT name, description, and file are required.' });
    }

    if (nft_name.length > 100 || nft_description.length > 500) {
      return res.status(400).json({ error: 'NFT name or description too long.' });
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

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SGLCN-X20 Minting API running on port ${PORT}`);
});

 