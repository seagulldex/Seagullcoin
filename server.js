


import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { mintNFT, verifySeagullCoinPayment, verifySeagullCoinTransaction } from './mintingLogic.js';
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
        code: code, // the authorization code received in the URL
        redirect_uri: XUMM_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch the access token.');
    }

    const data = await response.json();
    req.session.xumm = data; // Store access token and other info in session

    // Redirect to a success page or home
    return res.redirect('/'); // Redirect to a different page after successful login
  } catch (err) {
    console.error('Error during XUMM OAuth callback:', err);
    return res.status(500).json({ error: 'Failed to process XUMM OAuth callback.' });
  }
});

// Handle NFT Sell Offer with SeagullCoin
app.post('/sell-nft', async (req, res) => {
  const { nftId, sellPrice, walletAddress } = req.body;

  if (sellPrice <= 0) {
    return res.status(400).send('Sell price must be greater than zero.');
  }

  // Verify that the wallet is the owner of the NFT
  const isOwner = await verifyNFTOwnership(walletAddress, nftId);
  if (!isOwner) {
    return res.status(403).send('You do not own this NFT.');
  }

// Minting logic (SeagullCoin for minting, XRP for gas)
app.post('/mint', async (req, res) => {
  const { walletAddress, nftData } = req.body;
  
  // Check SeagullCoin balance (0.5 SGLCN)
  const balance = await checkSeagullCoinBalance(walletAddress);
  if (balance < 0.5) {
    return res.status(400).send('Insufficient SeagullCoin for minting.');
  }

  // Ensure the wallet has sufficient XRP for gas
  const xrpBalance = await checkXRPBalance(walletAddress);
  if (xrpBalance < 0.1) {  // Adjust the gas threshold as needed
    return res.status(400).send('Insufficient XRP for gas fees.');
  }

// XUMM OAuth2 login route
app.get('/login', (req, res) => {
  const xummLoginUrl = `https://xumm.app/oauth2/authorize?response_type=code&client_id=${XUMM_CLIENT_ID}&redirect_uri=${XUMM_REDIRECT_URI}`;
  res.redirect(xummLoginUrl);
});

// XUMM OAuth2 callback handler
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  
  // Exchange code for access token
  const tokenResponse = await axios.post('https://xumm.app/oauth2/token', {
    client_id: XUMM_CLIENT_ID,
    client_secret: XUMM_CLIENT_SECRET,
    code: code,
    redirect_uri: XUMM_REDIRECT_URI
  });

  // Store the access token and user information
  const { access_token, account } = tokenResponse.data;
  req.session.user = { account, access_token };

  // Redirect to the homepage or user dashboard
  res.redirect('/');
});


  // Proceed with minting the NFT
  const mintResult = await mintNFT(walletAddress, nftData);
  res.json(mintResult);
});


  // Create the sell offer with SeagullCoin
  const sellOfferResult = await createSellOffer(walletAddress, nftId, sellPrice);
  res.json(sellOfferResult);
});


// Handle NFT Buy Offer with SeagullCoin
app.post('/buy-nft', async (req, res) => {
  const { nftId, offerAmount, walletAddress } = req.body;

  if (offerAmount <= 0) {
    return res.status(400).send('Offer amount must be greater than zero.');
  }

  // Verify the SeagullCoin balance of the buyer
  const balance = await checkSeagullCoinBalance(walletAddress);
  if (balance < offerAmount) {
    return res.status(400).send('Insufficient SeagullCoin balance.');
  }

  // Proceed with the purchase transaction logic
  const purchaseResult = await processNFTPurchase(walletAddress, nftId, offerAmount);
  res.json(purchaseResult);
});

app.get('/wallet', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Please log in via XUMM first.');
  }

  // Use the XUMM API to fetch user wallet information
  const walletInfo = await axios.get(`https://xumm.app/api/v1/platform/wallet/${req.session.user.account}`, {
    headers: { Authorization: `Bearer ${req.session.user.access_token}` }
  });

  res.json(walletInfo.data);
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

// Minting route
app.post('/mint', async (req, res) => {
  const { walletAddress } = req.body;
  
  // Check the balance of SeagullCoin
  const balance = await checkSeagullCoinBalance(walletAddress);
  if (balance < 0.5) {
    return res.status(400).send('Insufficient SeagullCoin balance.');
  }

  // Proceed with the minting process if balance is sufficient
  const mintResult = await mintNFT(walletAddress);
  res.json(mintResult);
});

// ======= Buy NFT =======
apiRouter.post('/buy-nft', async (req, res) => {
  const { nftId, price } = req.body;

  if (!nftId || !price) {
    return res.status(400).json({ error: 'NFT ID and price are required.' });
  }

  try {
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
async function transferNFT(nftId, accessToken) {
  try {
    const response = await fetch('https://xumm.app/api/v1/platform/transfer_nft', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nftId, to: accessToken }),
    });

    if (!response.ok) {
      throw new Error('NFT transfer failed.');
    }

    return await response.json();
  } catch (err) {
    console.error(err);
    throw new Error('Error during NFT transfer.');
  }
}

async function getNFTsForSale() {
  // Simulated example - replace with actual database or storage lookup
  return [
    { id: '1', name: 'NFT 1', price: '10', description: 'First NFT for sale' },
    { id: '2', name: 'NFT 2', price: '20', description: 'Second NFT for sale' },
  ];
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});









