// server.js

// ============================
//          IMPORTS
// ============================
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import { NFTStorage, File } from 'nft.storage';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import xrpl from 'xrpl';
import NodeCache from 'node-cache';
import mongoose from 'mongoose';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';

// Internal Imports
import { mintNFT, verifySeagullCoinPayment, rejectXRPOffer, createSellOffer, acceptSellOffer, cancelOffer } from './mintingLogic.js';
import { client, fetchNFTs } from './xrplClient.js';
import { OfferModel } from './models/offerModel.js';
import { addListing, getNFTDetails, unlistNFT, getAllNFTListings } from './nftListings.js';

// ============================
//       ENV + CONFIG
// ============================
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// ============================
//      MIDDLEWARE SETUP
// ============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(limiter);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));

// ============================
//         SWAGGER DOCS
// ============================
const swaggerDocument = YAML.load(path.join(__dirname, './swagger.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ============================
//        FILE STORAGE
// ============================
const upload = multer({ dest: 'uploads/' });

// ============================
//         API ROUTES
// ============================

// Health Check
app.get('/health', (req, res) => res.status(200).send('API is healthy'));

// Mint NFT
app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const result = await mintNFT(req.body, req.file, req.session.wallet);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pay with SeagullCoin
app.post('/pay', async (req, res) => {
  try {
    const tx = await verifySeagullCoinPayment(req.body.wallet);
    res.json(tx);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Wallet NFTs
app.get('/nfts/:wallet', async (req, res) => {
  try {
    const nfts = await fetchNFTs(req.params.wallet);
    res.json(nfts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List NFT for Sale
app.post('/offer/list', async (req, res) => {
  try {
    const result = await createSellOffer(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Accept NFT Offer
app.post('/offer/accept', async (req, res) => {
  try {
    const result = await acceptSellOffer(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel Offer
app.post('/offer/cancel', async (req, res) => {
  try {
    const result = await cancelOffer(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reject XRP Offers
app.post('/offer/reject-xrp', async (req, res) => {
  try {
    const result = await rejectXRPOffer(req.body.nftoken_id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List Collection NFTs
app.get('/collection/:name', async (req, res) => {
  try {
    const collection = await getNFTDetails(req.params.name);
    res.json(collection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All Listings
app.get('/listings', async (req, res) => {
  try {
    const listings = await getAllNFTListings();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unlist
app.post('/unlist', async (req, res) => {
  try {
    const result = await unlistNFT(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
//          START SERVER
// ============================
app.listen(PORT, () => {
  console.log(`SGLCN-X20 NFT API server running on port ${PORT}`);
});
