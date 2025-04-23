import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mime from 'mime-types';
import dotenv from 'dotenv';
import { NFTStorage, File } from 'nft.storage';
import { XummSdk } from 'xumm-sdk';
import { Client, Wallet, convertStringToHex } from 'xrpl';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup paths & env
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup server
const app = express();
app.use(cors());
app.use(express.json());

// Upload config
const upload = multer({ dest: 'uploads/' });

// Setup XUMM & NFT.Storage
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

// Setup XRPL
const client = new Client('wss://s1.ripple.com');
const SERVICE_WALLET = Wallet.fromSeed(process.env.SERVICE_WALLET_SEED);
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const SEAGULLCOIN_CURRENCY_HEX = process.env.SEAGULLCOIN_CURRENCY_HEX;

await client.connect();
console.log("Connected to XRPL as:", SERVICE_WALLET.classicAddress);

// Health check
app.get('/', (req, res) => {
  res.send('SGLCN-X20 Minting API is live.');
});

// Verify payment
app.post('/pay', async (req, res) => {
  const { userWallet } = req.body;

  if (!userWallet) {
    return res.status(400).json({ success: false, error: 'Missing user wallet address' });
  }

  try {
    const { result } = await client.request({
      command: 'account_lines',
      account: userWallet
    });

    const match = result.lines.find(
      (line) =>
        line.currency === Buffer.from(SEAGULLCOIN_CURRENCY_HEX, 'hex').toString().replace(/\0/g, '') &&
        line.account === SEAGULLCOIN_ISSUER
    );

    if (!match || parseFloat(match.balance) < 0.5) {
      return res.status(400).json({ success: false, error: 'Insufficient SeagullCoin balance' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Payment check error:', err);
    res.status(500).json({ success: false, error: 'Error verifying payment' });
  }
});

// Mint NFT
app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const filePath = path.join(__dirname, req.file.path);
    const contentType = mime.lookup(filePath);

    const metadata = await nftStorage.store({
      name,
      description,
      image: new File([fs.readFileSync(filePath)], req.file.originalname, { type: contentType })
    });

    const tx = {
      TransactionType: 'NFTokenMint',
      Account: SERVICE_WALLET.classicAddress,
      URI: convertStringToHex(metadata.url),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0
    };

    const prepared = await client.autofill(tx);
    const signed = SERVICE_WALLET.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    fs.unlinkSync(filePath); // Clean up uploaded file

    res.json({
      success: true,
      metadataUrl: metadata.url,
      txHash: result.result.hash,
      nftokenId: result.result.meta?.nftoken_id || null
    });
  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ success: false, error: 'Minting failed' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SGLCN-X20 Minting API running on port ${PORT}`);
});
