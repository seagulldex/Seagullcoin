import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import NodeCache from 'node-cache';
import axios from 'axios';
import { Client } from 'xrpl';
import { NFTStorage, File } from 'nft.storage';
import session from 'express-session';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bodyParser from 'body-parser';
import joi from 'joi';
import { Sequelize, DataTypes } from 'sequelize';
import jwt from 'jsonwebtoken';
import { isValidAddress } from 'xrpl/dist/npm/models/common';

// Load environment variables
dotenv.config();

// Express setup
const app = express();
const port = process.env.PORT || 3000;

// Set up logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Initialize the XRPL client
const client = new Client('wss://s2.ripple.com');
client.connect();

// SeagullCoin info (hardcoded)
const SEAGULLCOIN_HEX = '53656167756C6C436F696E000000000000000000';
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';

// NFT.Storage setup
const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5000000 } }); // Max file size 5MB

// Rate limiting for minting
const mintingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: 'You can only mint 1 NFT per minute.',
});

// Cache setup
const nftCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// CORS configuration
const allowedOrigins = ['https://bidds.com', 'https://xrp.cafe'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'seagullcoin-secret', resave: false, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Sequelize setup for database (e.g., for users, NFTs, offers)
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: 'postgres',
  logging: false
});

const User = sequelize.define('User', {
  walletAddress: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, { timestamps: true });

const NFT = sequelize.define('NFT', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING
  },
  uri: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, { timestamps: true });

// Verify SeagullCoin payment before minting
async function verifySeagullCoinPayment(walletAddress) {
  try {
    const balance = await getSeagullCoinBalance(walletAddress);
    if (balance < 0.5) {
      throw new Error('Insufficient SeagullCoin balance. Minimum 0.5 required.');
    }
    return true;
  } catch (error) {
    throw new Error('Payment verification failed: ' + error.message);
  }
}

// Mint an NFT
async function mintNFT(walletAddress, nftData) {
  try {
    const ipfsMetadata = await uploadToNFTStorage(nftData.file);
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      URI: ipfsMetadata.cid,
      Flags: 0
    };
    const signedTx = await client.autofill(tx);
    const txResult = await client.submit(signedTx);
    return { status: 'success', txHash: txResult.result.tx_json.hash };
  } catch (error) {
    throw new Error('Minting failed: ' + error.message);
  }
}

// Upload file to NFT.Storage
async function uploadToNFTStorage(file) {
  try {
    const fileUpload = new File([file.buffer], file.originalname, { type: file.mimetype });
    const metadata = await nftStorageClient.store({ name: 'NFT', description: 'NFT minted on SeagullCoin', image: fileUpload });
    return metadata;
  } catch (error) {
    throw new Error('NFT upload failed: ' + error.message);
  }
}

// Function to get balance of SeagullCoin (SGLCN-X20) in a wallet
async function getSeagullCoinBalance(walletAddress) {
  try {
    const response = await client.request({
      command: 'account_info',
      account: walletAddress
    });
    const balance = response.result.account_data.Balances.find(b => b.currency === SEAGULLCOIN_HEX);
    return balance ? parseFloat(balance.value) : 0;
  } catch (error) {
    throw new Error('Error getting balance: ' + error.message);
  }
}

// API endpoint to mint NFT
app.post('/mint', mintingLimiter, async (req, res) => {
  try {
    const { walletAddress, nftData } = req.body;
    await verifySeagullCoinPayment(walletAddress); // Verify SeagullCoin payment
    const mintingResult = await mintNFT(walletAddress, nftData);
    res.status(200).json(mintingResult);
  } catch (error) {
    res.status(400).json({ message: 'Error minting NFT: ' + error.message });
  }
});

// Fetch recent NFTs (mocked here)
app.get('/nfts', async (req, res) => {
  try {
    // Fetch NFTs from cache or mock database
    let cachedNFTs = nftCache.get('recentNFTs');
    if (!cachedNFTs) {
      cachedNFTs = [{ name: 'NFT 1', cid: 'QmXyz...' }, { name: 'NFT 2', cid: 'QmAbc...' }];
      nftCache.set('recentNFTs', cachedNFTs);
    }
    res.status(200).json(cachedNFTs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching NFTs: ' + error.message });
  }
});

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SeagullCoin NFT Marketplace API',
      version: '1.0.0',
      description: 'API to manage and mint SeagullCoin-based NFTs',
    },
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Transfer NFT endpoint
app.post('/transfer', async (req, res) => {
  try {
    const { fromWallet, toWallet, nftId } = req.body;
    const tx = {
      TransactionType: 'NFTokenTransfer',
      Account: fromWallet,
      Destination: toWallet,
      NFTokenID: nftId
    };
    const signedTx = await client.autofill(tx);
    const txResult = await client.submit(signedTx);
    res.status(200).json({ status: 'success', txHash: txResult.result.tx_json.hash });
  } catch (error) {
    res.status(500).json({ message: 'Error transferring NFT: ' + error.message });
  }
});

// Delist NFT endpoint
app.post('/delist', async (req, res) => {
  try {
    const { nftId } = req.body;
    // Logic to remove NFT from sale listing or marketplace
    res.status(200).json({ status: 'success', message: 'NFT delisted' });
  } catch (error) {
    res.status(500).json({ message: 'Error delisting NFT: ' + error.message });
  }
});

// Accept Offer endpoint
app.post('/accept-offer', async (req, res) => {
  try {
    const { nftId, offerAmount, offerWallet } = req.body;
    // Logic to accept the offer for an NFT
    res.status(200).json({ status: 'success', message: 'Offer accepted', nftId, offerAmount, offerWallet });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting offer: ' + error.message });
  }
});

// Reject Offer endpoint
app.post('/reject-offer', async (req, res) => {
  try {
    const { nftId, offerWallet } = req.body;
    // Logic to reject the offer for an NFT
    res.status(200).json({ status: 'success', message: 'Offer rejected', nftId, offerWallet });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting offer: ' + error.message });
  }
});

// Burn NFT endpoint
app.post('/burn', async (req, res) => {
  try {
    const { nftId, walletAddress } = req.body;
    const tx = {
      TransactionType: 'NFTokenBurn',
      Account: walletAddress,
      NFTokenID: nftId
    };
    const signedTx = await client.autofill(tx);
    const txResult = await client.submit(signedTx);
    res.status(200).json({ status: 'success', message: 'NFT burned', txHash: txResult.result.tx_json.hash });
  } catch (error) {
    res.status(500).json({ message: 'Error burning NFT: ' + error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
