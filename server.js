// ===== Imports =====
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import xrpl from 'xrpl';
import { mintNFT, verifySeagullCoinPayment, verifySeagullCoinTransaction, transferNFT, checkOwnership } from './mintingLogic.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { NFTStorage, File } from 'nft.storage';
import { client } from './xrplClient.js';
import { getAllNFTListings, unlistNFT, addListing } from './helpers/nftListings.js';
import { getNFTDetails } from './xrplClient.js';

// ===== Config =====
dotenv.config();

const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI, SGLCN_ISSUER, SERVICE_WALLET } = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// ===== Middleware =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6000,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use(limiter);
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'sglcn_secret_session',
  resave: false,
  saveUninitialized: true,
}));

// ===== Static Files =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== Swagger Docs =====
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ===== Health Check =====
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server running', timestamp: new Date().toISOString() });
});

// ===== Root Route =====
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the SGLCN-X20 Minting API. Visit /api-docs for documentation.' });
});

// ====== API Routes ======
const apiRouter = express.Router();

// ======= XUMM OAuth =======
apiRouter.get('/login/start', (req, res) => {
  res.json({ message: 'Use /api/login to start XUMM OAuth2 login flow.' });
});

apiRouter.get('/login', (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}&scope=identity%20payload`;
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
    res.status(500).json({ error: 'Failed to mint NFT.' });
  }
});

// ======= Buy NFT =======
apiRouter.post('/buy-nft', async (req, res) => {
  const { nftId, price, currency } = req.body;  // Include currency check
  if (!nftId || !price) {
    return res.status(400).json({ error: 'NFT ID and price required.' });
  }

  // **Check if the listing is in SeagullCoin**
  if (currency !== "53656167756C6C436F696E000000000000000000") {
    return res.status(400).json({ error: 'NFTs can only be purchased using SeagullCoin (SGLCN-X20).' });
  }

  try {
    const paymentValid = await verifySeagullCoinTransaction(req.session.xumm, price);
    if (!paymentValid) {
      return res.status(402).json({ error: 'Insufficient SeagullCoin payment.' });
    }

    const walletAddress = req.session.walletAddress;
    const purchaseResult = await transferNFT(nftId, walletAddress);
    res.json({ success: true, purchaseResult });
  } catch (err) {
    console.error('Buying NFT error:', err);
    res.status(500).json({ error: 'Failed to process NFT purchase.' });
  }
});

// ======= NFT Listings =======
apiRouter.get('/nft-listings', (req, res) => {
  try {
    const listings = getAllNFTListings();
    res.json({ success: true, listings });
  } catch (err) {
    console.error('Error fetching NFT listings:', err);
    res.status(500).json({ error: 'Failed to fetch NFT listings.' });
  }
});

apiRouter.post('/unlist-nft', (req, res) => {
  const { nftId } = req.body;
  const userAddress = req.session.walletAddress;

  if (!userAddress) {
    return res.status(400).send('User not logged in');
  }

  try {
    const success = unlistNFT(nftId, userAddress);
    if (!success) {
      return res.status(400).send('You are not authorized to unlist this NFT');
    }
    res.status(200).send('NFT unlisted successfully');
  } catch (error) {
    console.error('Unlist NFT error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ======= Sell NFT =======
apiRouter.post('/sell-nft', async (req, res) => {
  const { nftId, price, currency } = req.body;  // Include currency check
  const userAddress = req.session.walletAddress;

  if (!userAddress) {
    return res.status(400).send('User not logged in');
  }

  if (price <= 0) {
    return res.status(400).send('Price must be greater than zero');
  }

  // **Check if the listing price is in SeagullCoin**
  if (currency !== "53656167756C6C436F696E000000000000000000") {
    return res.status(400).send('NFTs can only be listed for sale in SeagullCoin (SGLCN-X20).');
  }

  try {
    const nft = await getNFTDetails(nftId);

    if (!nft || nft.owner !== userAddress) {
      return res.status(400).send('You are not the owner of this NFT');
    }

    addListing(nftId, price, userAddress);
    res.status(200).send('NFT listed for sale');
  } catch (error) {
    console.error('Sell NFT error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ====== Mount API Router ======
app.use('/api', apiRouter);

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on https://sglcn-x20-api.glitch.me/`);
});

