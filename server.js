import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { mintNFT, verifySeagullCoinPayment } from './mintingLogic.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import axios from 'axios';

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
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Base root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the SGLCN-X20 Minting API. Visit /api-docs for full documentation.',
  });
});

// ========== API Routes ==========
const apiRouter = express.Router();

// XUMM OAuth2 login route
apiRouter.get('/login', (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}&scope=identity%20payload`;
  res.redirect(authUrl);
});

// XUMM OAuth2 callback handler
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

    // Redirect to a success page or home
    return res.redirect('/'); // Redirect to a different page after successful login
  } catch (err) {
    console.error('Error during XUMM OAuth callback:', err);
    return res.status(500).json({ error: 'Failed to process XUMM OAuth callback.' });
  }
});

// ========================== Sell NFT ==========================

apiRouter.post('/sell-nft', async (req, res) => {
  const { nftId, price } = req.body;

  try {
    if (!nftId || !price) {
      return res.status(400).json({ error: 'NFT ID and price are required.' });
    }

    // Validate price is a positive number
    if (isNaN(price) || parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Invalid price. It should be a positive number.' });
    }

    // Verify SeagullCoin payment before listing for sale
    const paymentValid = await verifySeagullCoinPayment(req.session.xumm);
    if (!paymentValid) {
      return res.status(402).json({ error: '0.5 SeagullCoin payment required to list an NFT for sale.' });
    }

    // Logic for listing NFT for sale (you may need to integrate with your database or blockchain service here)
    const saleResult = await listNFTForSale(nftId, price, req.session.xumm.access_token);

    return res.json({ success: true, saleResult });
  } catch (err) {
    console.error('Error selling NFT:', err);
    return res.status(500).json({ error: 'An error occurred while selling the NFT.' });
  }
});

// Helper function for listing NFT for sale
async function listNFTForSale(nftId, price, accessToken) {
  // Placeholder for actual logic to list NFT for sale, such as interacting with your blockchain or database
  // Replace this with your logic to set the NFT price for sale
  const result = await axios.post('https://api.nftplatform.io/list_for_sale', {
    nftId,
    price,
    accessToken,
  });

  return result.data;
}

// ======= Mint NFT =======
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for files
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only image and video files are allowed.'));
    }
    cb(null, true);
  }
});

// Cancel XRP offers route
apiRouter.post('/cancel-xrp-offers', async (req, res) => {
  const { nftId } = req.body;

  if (!nftId) {
    return res.status(400).json({ error: 'NFT ID is required.' });
  }

  try {
    // Verify the NFT is listed for sale and check if the offer is for XRP
    const offer = await getNFTOffer(nftId); // Assume a function that fetches the offer based on nftId

    // Check if the offer is for XRP
    if (offer && offer.currency === 'XRP') {
      // Cancel the XRP offer using the XRPL API (or your own logic)
      const cancelResult = await cancelXRPOffer(offer.id);
      
      if (cancelResult.success) {
        return res.json({ success: true, message: 'XRP offer successfully canceled.' });
      } else {
        return res.status(500).json({ error: 'Failed to cancel XRP offer.' });
      }
    } else {
      return res.status(400).json({ error: 'No XRP offer found for the given NFT.' });
    }
  } catch (err) {
    console.error('Error canceling XRP offer:', err);
    return res.status(500).json({ error: 'An error occurred while canceling the XRP offer.' });
  }
});

// Helper function to get the offer by NFT ID
async function getNFTOffer(nftId) {
  // Placeholder logic to fetch the NFT offer (you may need to integrate with your database or blockchain service here)
  const offer = await axios.get(`https://api.nftplatform.io/get_offer_by_nft_id/${nftId}`);
  return offer.data;
}

// Helper function to cancel the XRP offer on XRPL
async function cancelXRPOffer(offerId) {
  try {
    // Construct the XRP transaction to cancel the offer (e.g., using XRPL's cancel offer mechanism)
    const cancelTransaction = {
      TransactionType: 'OfferCancel',
      OfferSequence: offerId, // Offer sequence to be canceled
      Account: process.env.XRP_ACCOUNT, // Your XRPL account
    };

    const response = await axios.post('https://xrpl-api.example.com/cancel_offer', cancelTransaction);

    if (response.data.success) {
      return { success: true };
    } else {
      return { success: false };
    }
  } catch (err) {
    console.error('Error canceling XRP offer on XRPL:', err);
    return { success: false };
  }
}


// Mint NFT route (POST)
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

    // Check for duplicate NFT minting
    const nftExists = await checkIfNFTExists(nft_name, nft_description);
    if (nftExists) {
      return res.status(409).json({ error: 'This NFT already exists. Please use a unique name and description.' });
    }

    // Verify SeagullCoin payment before minting
    const paymentValid = await verifySeagullCoinPayment(req.session.xumm);
    if (!paymentValid) {
      return res.status(402).json({ error: '0.5 SeagullCoin payment required before minting.' });
    }

    // Prepare metadata
    const metadata = {
      name: nft_name,
      description: nft_description,
      domain,
      properties: properties ? JSON.parse(properties) : {},
      file: nft_file.path,
    };

    // Mint NFT logic
    const mintResult = await mintNFT(metadata, req.session.xumm.access_token);
    return res.json({ success: true, mintResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'An error occurred while minting the NFT.' });
  }
});

// Helper Functions

async function checkIfNFTExists(nft_name, nft_description) {
  // Placeholder for checking duplicate NFTs
  // Replace this with actual database or blockchain queries to check for existing NFTs

  const existingNFT = await axios.get('https://api.nftplatform.io/check_duplicate', {
    params: { nft_name, nft_description },
  });

  if (existingNFT.data.exists) {
    return true; // NFT already exists
  }

  return false;
}

// Mint NFT route (POST)
apiRouter.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;

  if (!nft_name || !nft_description || !domain || !properties || !req.file) {
    return res.status(400).json({ error: 'Missing required fields (name, description, domain, properties, file).' });
  }

  try {
    // Verify SeagullCoin payment
    const paymentValid = await verifySeagullCoinPayment(req.session.xumm);
    if (!paymentValid) {
      return res.status(402).json({ error: '0.5 SeagullCoin payment required to mint an NFT.' });
    }

    // Logic to upload the file to NFT.Storage (you can use your existing storage logic here)
    const mediaUrl = await uploadToNFTStorage(req.file);

    // Prepare metadata for the NFT
    const metadata = {
      name: nft_name,
      description: nft_description,
      domain: domain,
      properties: JSON.parse(properties),
      media_url: mediaUrl,
    };

    // Logic to mint the NFT using the SeagullCoin transaction (custom minting logic)
    const mintResult = await mintNFT(metadata, req.session.xumm.access_token);

    // Return the result of minting
    return res.json({ success: true, mintResult });
  } catch (err) {
    console.error('Error minting NFT:', err);
    return res.status(500).json({ error: 'An error occurred while minting the NFT.' });
  }
});

// Helper function to upload the NFT file to NFT.Storage
async function uploadToNFTStorage(file) {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));

    const response = await axios.post('https://api.nft.storage/upload', formData, {
      headers: {
        'Authorization': `Bearer ${process.env.NFT_STORAGE_API_KEY}`,
        'Content-Type': 'multipart/form-data',
      }
    });

    if (response.status !== 200) {
      throw new Error('Failed to upload file to NFT.Storage');
    }

    return `https://ipfs.io/ipfs/${response.data.value.cid}`;
  } catch (error) {
    console.error('Error uploading file to NFT.Storage:', error);
    throw new Error('Failed to upload file to NFT.Storage.');
  }
}

// Use the API router
app.use('/api', apiRouter);

// Start the app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
