import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, xrpToDrops } from 'xrpl';
import multer from 'multer';
import mime from 'mime-types';
import { nftStorage } from 'nft.storage';
import fs from 'fs';
import path from 'path';
import { xummSdk } from 'xumm-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const client = new Client('wss://s2.ripple.com'); // XRPL WebSocket client
const SEAGULLCOIN_CURRENCY_HEX = '53656167756C6C436F696E000000000000000000'; // SeagullCoin currency code (in hex)
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'; // SeagullCoin issuer address

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File Upload Setup
const upload = multer({ dest: 'uploads/' });

// XUMM SDK initialization (if you're using XUMM)
const xumm = new xummSdk(process.env.XUMM_API_KEY);

// Payment Verification Endpoint
app.post('/pay', async (req, res) => {
  const { userWallet } = req.body;

  try {
    const accountLines = await client.request({
      command: 'account_lines',
      account: userWallet
    });

    // Find SeagullCoin line
    const line = accountLines.result.lines.find(
      (l) =>
        l.currency === Buffer.from(SEAGULLCOIN_CURRENCY_HEX, 'hex').toString().replace(/\0/g, '') &&
        l.account === SEAGULLCOIN_ISSUER
    );

    // Insufficient SeagullCoin balance
    if (!line) {
      const errorMessage = `No SeagullCoin trustline found for user ${userWallet}`;
      console.error(errorMessage);
      return res.status(400).json({ success: false, error: errorMessage });
    }

    if (parseFloat(line.balance) < 0.5) {
      const errorMessage = `Insufficient SeagullCoin balance for user ${userWallet}: ${line.balance} available`;
      console.error(errorMessage);
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // If everything is good, respond with success
    return res.json({ success: true });

  } catch (err) {
    // Handle network or other errors
    const errorMessage = `Error verifying payment for user ${userWallet}: ${err.message || err}`;
    console.error(errorMessage); // Log the full error
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Mint NFT Endpoint
app.post('/mint', upload.single('file'), async (req, res) => {
  const { name, description, collection } = req.body;
  const file = req.file;

  if (!file || !name || !description || !collection) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields (name, description, collection, or file).'
    });
  }

  try {
    // Upload media to NFT.Storage
    const metadata = await nftStorage.store({
      name,
      description,
      collection,
      file: new File([fs.readFileSync(file.path)], file.originalname, { type: mime.lookup(file.originalname) }),
    });

    // Save the metadata URL (return it in the response)
    const nftMetadataUrl = metadata.url;
    fs.unlinkSync(file.path); // Cleanup file after upload

    return res.json({
      success: true,
      nftMetadataUrl
    });

  } catch (err) {
    console.error(`Error minting NFT: ${err.message || err}`);
    return res.status(500).json({
      success: false,
      error: `Error minting NFT: ${err.message || err}`
    });
  }
});

// Example GET endpoint to check if the API is live
app.get('/', (req, res) => {
  res.json({ message: 'SGLCN-X20 Minting API is live' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
