import express from 'express';  
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { mintNFT, verifySeagullCoinPayment } from './mintingLogic.js'; // mintNFT and verifySeagullCoinPayment should be implemented
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs'; // Import fs to read the JSON file
import FormData from 'form-data';

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// XUMM OAuth2 constants from .env
const XUMM_CLIENT_ID = process.env.XUMM_CLIENT_ID;
const XUMM_CLIENT_SECRET = process.env.XUMM_CLIENT_SECRET;
const XUMM_REDIRECT_URI = process.env.XUMM_REDIRECT_URI;

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

// Add the root route to serve a response for / (root)
app.get('/', (req, res) => {
  res.send('Welcome to the SeagullCoin NFT Minting API!');
});

// ========== XUMM OAUTH2 ==========
app.get("/api/login", (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}&scope=identity%20payload`;
  res.redirect(authUrl);
});

app.get("/api/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const tokenRes = await fetch("https://oauth2.xumm.app/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${XUMM_CLIENT_ID}:${XUMM_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}`,
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      req.session.xumm = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      };
      res.redirect("/docs");
    } else {
      res.status(400).json({ error: "Failed to authenticate with XUMM" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth2 Error");
  }
});

// ======= NFT Minting Route =======
const upload = multer({ dest: 'uploads/' }); // For file uploads
app.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;
  const nft_file = req.file;

  try {
    // Ensure SeagullCoin payment before minting
    const paymentValid = await verifySeagullCoinPayment(req.session.xumm);
    if (!paymentValid) {
      return res.status(400).json({ error: 'Minting requires 0.5 SeagullCoin payment' });
    }

    // Ensure the file is uploaded properly
    if (!nft_file) {
      return res.status(400).json({ error: 'File upload failed' });
    }

    // Prepare metadata and file for NFT.Storage upload
    const metadata = {
      name: nft_name,
      description: nft_description,
      domain: domain,
      properties: properties,
      image: ''  // This will be filled with the IPFS link once the file is uploaded
    };

    // Upload the file to NFT.Storage
    const form = new FormData();
    form.append('file', fs.createReadStream(nft_file.path));

    const fileUploadRes = await fetch('https://api.nft.storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
      },
      body: form,
    });

    const fileUploadData = await fileUploadRes.json();
    if (!fileUploadData.ok) {
      throw new Error('Failed to upload file to NFT.Storage');
    }

    const ipfsLink = `https://ipfs.io/ipfs/${fileUploadData.value.cid}`;
    metadata.image = ipfsLink;

    // Upload metadata to NFT.Storage
    const metadataForm = new FormData();
    metadataForm.append('file', Buffer.from(JSON.stringify(metadata), 'utf-8'), 'metadata.json');
    
    const metadataUploadRes = await fetch('https://api.nft.storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
      },
      body: metadataForm,
    });

    const metadataUploadData = await metadataUploadRes.json();
    if (!metadataUploadData.ok) {
      throw new Error('Failed to upload metadata to NFT.Storage');
    }

    const metadataLink = `https://ipfs.io/ipfs/${metadataUploadData.value.cid}`;
    
    // Return minted NFT info
    res.json({
      success: true,
      nftId: metadataLink, // Returning the metadata link as the NFT ID
      metadata: metadataLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/docs`);
});
