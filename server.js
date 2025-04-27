// ===== Imports =====
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

// ===== Config =====
dotenv.config();

// Load environment variables
const { XUMM_CLIENT_ID, XUMM_CLIENT_SECRET, XUMM_REDIRECT_URI } = process.env;

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
    req.session.xumm = data; 
    req.session.walletAddress = data.account; 

    return res.redirect('/'); 
  } catch (err) {
    console.error('Error during XUMM OAuth callback:', err);
    return res.status(500).json({ error: 'Failed to process XUMM OAuth callback.' });
  }
});

// ======= NFT Minting =======
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileName = Date.now() + path.extname(file.originalname);
    cb(null, fileName);
  }
});

const upload = multer({ storage });

// Minting NFT endpoint
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

    // Validate SeagullCoin payment
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
    const paymentValid = await verifySeagullCoinTransaction(req.session.xumm, price);
    if (!paymentValid) {
      return res.status(402).json({ error: 'Insufficient SeagullCoin payment.' });
    }

    const walletAddress = req.session.walletAddress;
    const purchaseResult = await transferNFT(nftId, walletAddress);
    return res.json({ success: true, purchaseResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'An error occurred while processing the NFT purchase.' });
  }
});

// Admin routes
const adminRouter = express.Router();

// View all NFTs
adminRouter.get('/admin/nfts', async (req, res) => {
  try {
    const allNFTs = await getAllNFTs(); // Replace with your DB function
    res.json({ success: true, nfts: allNFTs });
  } catch (err) {
    console.error('Error fetching NFTs:', err);
    res.status(500).json({ error: 'Failed to fetch NFTs.' });
  }
});

// View all users (simplified, consider using an actual DB query for users)
adminRouter.get('/admin/users', async (req, res) => {
  try {
    const users = await getAllUsers(); // Replace with actual DB query
    res.json({ success: true, users: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Manage listings (simplified for now)
adminRouter.post('/admin/manage-listing', async (req, res) => {
  const { nftId, action } = req.body; // Example action: 'delete', 'activate'

  try {
    if (!nftId || !action) {
      return res.status(400).json({ error: 'NFT ID and action are required.' });
    }

    // Implement logic to handle different actions (e.g., activate/deactivate/delete listings)
    const result = await manageListing(nftId, action); // Add your DB logic here
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error managing listing:', err);
    res.status(500).json({ error: 'Failed to manage listing.' });
  }
});

import { NFTStorage, File } from 'nft.storage';

const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

async function mintNFT(metadata, walletAddress) {
  try {
    // Upload NFT file to NFT.Storage
    const nftFile = fs.readFileSync(metadata.file); // File read from local path
    const file = new File([nftFile], metadata.name, { type: 'image/jpeg' });

    // Upload metadata
    const metadataWithFile = {
      name: metadata.name,
      description: metadata.description,
      domain: metadata.domain,
      properties: metadata.properties,
      image: file,
    };

    // Upload to IPFS
    const uploaded = await nftStorageClient.store(metadataWithFile);
    const metadataUrl = `https://ipfs.io/ipfs/${uploaded.ipnft}`;

    // Your minting logic here
    // For example: send a transaction to mint the NFT on the XRPL using metadataUrl

    return { metadataUrl, success: true }; // Return the metadata URL after minting
  } catch (err) {
    console.error('Error minting NFT:', err);
    throw new Error('Failed to mint NFT.');
  }
}

// Attach admin routes under '/admin'
app.use('/admin', adminRouter);

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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ======= Helper Functions ==========
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
  return [
    { id: '1', name: 'NFT 1', price: '10', description: 'First NFT for sale' },
    { id: '2', name: 'NFT 2', price: '20', description: 'Second NFT for sale' },
  ];
}
