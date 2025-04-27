import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { mintNFT, verifySeagullCoinPayment, verifySeagullCoinTransaction, cancelXRPOfferProtection, createSeagullCoinOffer, getNFTsForSale, transferNFT } from './mintingLogic.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

// Load environment variables
dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// XUMM OAuth2 constants from .env
const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI } = process.env;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests from this IP, please try again later.' },
});

// Middleware
app.use(limiter);
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "sglcn_secret_session",
  resave: false,
  saveUninitialized: true,
}));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Base root
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the SGLCN-X20 Minting API. Visit /api-docs for full documentation.',
  });
});

// ========== API Routes ==========
const apiRouter = express.Router();

// XUMM Login
apiRouter.get('/login', (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}&scope=identity%20payload`;
  res.redirect(authUrl);
});

// XUMM OAuth2 callback
apiRouter.get('/xumm/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received from XUMM.' });
  }

  try {
    // Exchange the authorization code for an access token
    const response = await fetch('https://xumm.app/api/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${XUMM_CLIENT_ID}:${XUMM_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: XUMM_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch the access token.');
    }

    const data = await response.json();
    req.session.xumm = data; // Store access token and other info in session

    return res.redirect('/'); // Redirect to a different page after successful login
  } catch (err) {
    console.error('Error during XUMM OAuth callback:', err);
    return res.status(500).json({ error: 'Failed to process XUMM OAuth callback.' });
  }
});

// ======= NFT Minting =======
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only image and video files are allowed.'));
    }
    cb(null, true);
  }
});

apiRouter.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;
  const nft_file = req.file;

  try {
    if (!nft_name || !nft_description || !nft_file) {
      return res.status(400).json({ error: 'NFT name, description, and file are required.' });
    }

    if (nft_name.length > 100 || nft_description.length > 500) {
      return res.status(400).json({ error: 'NFT name or description exceeds allowed length.' });
    }

    // Verify SeagullCoin payment for minting
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

    const mintResult = await mintNFT(metadata, req.session.xumm.access_token);
    return res.json({ success: true, mintResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'An error occurred while minting the NFT.' });
  }
});

// ======= Buy NFT =======
apiRouter.post('/buy-nft', async (req, res) => {
  const { nftId, price } = req.body;

  if (!nftId || !price) {
    return res.status(400).json({ error: 'NFT ID and price are required.' });
  }

  try {
    // Verify SeagullCoin payment for purchasing the NFT
    const paymentValid = await verifySeagullCoinTransaction(req.session.xumm, price);
    if (!paymentValid) {
      return res.status(402).json({ error: 'Insufficient SeagullCoin payment.' });
    }

    const purchaseResult = await transferNFT(nftId, req.session.xumm.access_token);
    return res.json({ success: true, purchaseResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'An error occurred while processing the NFT purchase.' });
  }
});

// ======= Get NFTs For Sale =======
apiRouter.get('/nfts', async (req, res) => {
  try {
    const nftsForSale = await getNFTsForSale();
    return res.json({ success: true, nfts: nftsForSale });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'An error occurred fetching NFTs for sale.' });
  }
});

// Attach the API router under '/api'
app.use('/api', apiRouter);

// ========== Helper Functions ==========
async function cancelXRPOfferProtection(nftId) {
  try {
    const response = await fetch('https://xumm.app/api/v1/platform/cancel_xrp_offer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.xumm.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nftId }),
    });

    if (!response.ok) {
      throw new Error('Cancel XRP offer failed.');
    }

    return await response.json();
  } catch (err) {
    console.error(err);
    throw new Error('Error during XRP offer cancellation.');
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
