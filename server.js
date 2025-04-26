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
const XUMM_CLIENT_ID = process.env.XUMM_CLIENT_ID;
const XUMM_CLIENT_SECRET = process.env.XUMM_CLIENT_SECRET;
const XUMM_REDIRECT_URI = process.env.XUMM_REDIRECT_URI;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
});

app.use(limiter);

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "sglcn_secret_session",
  resave: false,
  saveUninitialized: true,
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Swagger JSON for API docs
app.get('/swagger.json', (req, res) => {
  const swaggerPath = path.join(__dirname, 'swagger.json');
  fs.readFile(swaggerPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send("Error reading swagger.json");
    }
    res.json(JSON.parse(data));
  });
});

// ========== XUMM OAUTH2 ==========
app.get("/api/login", (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}&scope=identity%20payload`;
  res.redirect(authUrl);
});

// Add a simple root route for the API
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the SGLCN-X20 Minting API. Please refer to /swagger.json for API documentation.',
  });
});

// ======= NFT Minting Route =======
const upload = multer({ 
  dest: uploadsDir,  // Set the dynamic 'uploads' folder path
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit file size to 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only image and video files are allowed'));
    }
    cb(null, true);
  }
}); 

app.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;
  const nft_file = req.file;

  try {
    // Validate inputs
    if (!nft_name || nft_name.trim() === '') {
      return res.status(400).json({ error: 'NFT name is required' });
    }

    if (!nft_description || nft_description.trim() === '') {
      return res.status(400).json({ error: 'NFT description is required' });
    }

    if (nft_name.length > 100) {
      return res.status(400).json({ error: 'NFT name cannot exceed 100 characters' });
    }

    if (nft_description.length > 500) {
      return res.status(400).json({ error: 'NFT description cannot exceed 500 characters' });
    }

    // Ensure SeagullCoin payment before minting
    const paymentValid = await verifySeagullCoinPayment(req.session.xumm);
    if (!paymentValid) {
      return res.status(400).json({ error: 'Minting requires 0.5 SeagullCoin payment' });
    }

    // Ensure the file is uploaded properly
    if (!nft_file) {
      return res.status(400).json({ error: 'File upload failed. Please provide a valid image or video file.' });
    }

    // Prepare metadata and file for NFT
    const metadata = {
      name: nft_name,
      description: nft_description,
      domain,
      properties: JSON.parse(properties),
      file: nft_file.path,
    };

    // Call minting function (this part could integrate your logic with NFT.Storage or XUMM)
    const mintResult = await mintNFT(metadata, req.session.xumm.access_token);
    
    res.json({ success: true, mintResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while minting your NFT.' });
  }
});

// ======= Buying NFTs Route =======
app.post('/buy-nft', async (req, res) => {
  const { nftId, price } = req.body;
  
  if (!nftId || !price) {
    return res.status(400).json({ error: 'NFT ID and price are required' });
  }

  try {
    // Verify SeagullCoin transaction for payment
    const paymentValid = await verifySeagullCoinTransaction(req.session.xumm, price);
    if (!paymentValid) {
      return res.status(400).json({ error: 'Transaction failed, insufficient SeagullCoin payment' });
    }

    // Process the NFT purchase logic (transfer NFT to buyer, update the sale status)
    const purchaseResult = await transferNFT(nftId, req.session.xumm.access_token);

    res.json({ success: true, purchaseResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while processing your NFT purchase.' });
  }
});

// ========== Transfer NFT Logic ==========
async function transferNFT(nftId, accessToken) {
  try {
    // Example transfer logic (ensure you customize this based on your platform's requirements)
    const response = await fetch('https://xumm.app/api/v1/platform/transfer_nft', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nftId, to: accessToken }), // Customize the transfer data
    });

    if (!response.ok) {
      throw new Error('Failed to transfer NFT');
    }

    const transferResult = await response.json();
    return transferResult;
  } catch (err) {
    console.error(err);
    throw new Error('Error during NFT transfer');
  }
}

// Start the Express app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
