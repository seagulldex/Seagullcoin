


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
import NFTModel from './models/nftModel.js'; // Adjust path if necessary
import OfferModel from './models/offerModel.js'; // Adjust path if necessary

// At the top of your server.js
const NodeCache = require('node-cache');
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });  // Cache for 10 minutes

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
  // Placeholder for fetching NFTs from a database or using an API
  // Example:
  // return await db.query('SELECT * FROM nfts WHERE owner = ?', [walletAddress]);

  // Replace this with actual logic to fetch NFTs from your storage or blockchain
  return [];  // Return an empty array for now, if no actual logic is implemented
}

// Example of pagination for /nfts
app.get('/nfts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // Default page to 1
  const limit = parseInt(req.query.limit) || 20;  // Default limit to 20

  const skip = (page - 1) * limit;

  try {
    const nfts = await NFTModel.find()
      .skip(skip)  // Skip previous pages
      .limit(limit)  // Limit the number of results
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
  // Start OAuth flow
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
    // Exchange code for access token
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

    // Store session data
    const data = await response.json();
    req.session.xumm = data;  // Store XUMM OAuth data
    req.session.walletAddress = data.account;  // Store wallet address

    // Redirect user to homepage or profile after successful login
    res.redirect('/');  // Or any other page you wish to redirect
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
    res.redirect('/');  // Redirect after logout
  });
});

// ======= Check Login State =======
apiRouter.get('/login/check', (req, res) => {
  // Check if user is logged in by looking for session data
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
  const { nftId, price, currency } = req.body;
  if (!nftId || !price) {
    return res.status(400).json({ error: 'NFT ID and price required.' });
  }

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
  const { nftId, price, currency } = req.body;
  const userAddress = req.session.walletAddress;

  if (!userAddress) {
    return res.status(400).send('User not logged in');
  }

  if (price <= 0) {
    return res.status(400).send('Price must be greater than zero');
  }

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

// API Route for updating profile
apiRouter.post('/update-profile', upload.single('profile_picture'), async (req, res) => {
    const { username } = req.body;
    const profilePicture = req.file;

    try {
        const walletAddress = req.session.walletAddress;
        if (!walletAddress) {
            return res.status(401).json({ error: 'User not logged in' });
        }
        // Here you would update the user profile in your database or data store
        // For now, we just simulate this by returning a success message
        // You could store the username and image URL here.

        res.json({ success: true });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

app.get('/nfts', async (req, res) => {
  // Replace this with actual logic to fetch from your NFT database or files
  res.json([
    {
      name: "Seagull Sunset",
      description: "A seagull enjoying a golden sunset.",
      media: "https://example.com/nft1.png",
      price: "1.2",
      fileType: "image",
      onSale: true,
      rarity: "Rare",
      dateMinted: "2025-04-27",
      collection: {
        name: "Coastal Birds",
        icon: "https://example.com/coastal_birds_logo.png"
      }
    },
    // Add more NFTs...
  ]);
});

app.get("/user-offers", async (req, res) => {
  const address = req.query.address;
  if (!address) return res.status(400).json({ error: "Address required" });

  try {
    const response = await client.request({
      command: "account_nft_sell_offers",
      account: address
    });

    const offers = response.result.offers || [];

    // Separate offers into "listed" and "incoming"
    const listed = [];
    const incoming = [];

    for (const offer of offers) {
      if (offer.owner === address) {
        listed.push(offer);
      } else {
        incoming.push(offer);
      }
    }

    res.json({ listed, incoming });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add this in your routes section of server.js

app.get('/nfts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // Default to page 1
  const limit = parseInt(req.query.limit) || 20;  // Default limit to 20

  const cacheKey = `nfts_page_${page}_limit_${limit}`;
  const cachedData = myCache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);  // Return cached data if it exists
  }

  try {
    const nfts = await NFTModel.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    myCache.set(cacheKey, nfts);  // Cache the result
    res.json(nfts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// Example for /user-offers route
app.get('/user-offers', async (req, res) => {
  const page = parseInt(req.query.page) || 1;  
  const limit = parseInt(req.query.limit) || 20;

  const cacheKey = `user_offers_user_${req.query.userId}_page_${page}_limit_${limit}`;
  const cachedData = myCache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);  // Return cached data if it exists
  }

  try {
    const offers = await OfferModel.find({ userId: req.query.userId })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    myCache.set(cacheKey, offers);  // Cache the result
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// ======= Get User's NFTs =======
apiRouter.get('/user-nfts', async (req, res) => {
  const walletAddress = req.session.walletAddress;

  // Check if user is authenticated (wallet address exists in session)
  if (!walletAddress) {
    return res.status(400).json({ error: 'User is not authenticated.' });
  }

  try {
    // Fetch NFTs for the user
    const userNFTs = await getUserNFTs(walletAddress);  // Assume this function gets NFTs for a given wallet address

    // If no NFTs found, return 404
    if (!userNFTs || userNFTs.length === 0) {
      return res.status(404).json({ error: 'No NFTs found for the user.' });
    }

    // Respond with the user's NFTs
    res.json({ userNFTs });
  } catch (err) {
    console.error('Error fetching user NFTs:', err);
    res.status(500).json({ error: 'Failed to fetch user NFTs.' });
  }
});


// ====== Mount API Router ======
app.use('/api', apiRouter);

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



