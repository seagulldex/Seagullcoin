import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mime from 'mime-types';
import { NFTStorage, File } from 'nft.storage';
import xrpl from 'xrpl';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup
dotenv.config();
const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Env vars
const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;
const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY;
const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;
const SGLCN_CURRENCY_HEX = process.env.SGLCN_CURRENCY_HEX;

// XRPL client
const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233'); // or mainnet URL

// Middleware
app.use(cors());
app.use(express.json());

// Home
app.get('/', (req, res) => {
  res.send('SGLCN-X20 Minting API is running!');
});

// Verify SeagullCoin payment before mint
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  try {
    await client.connect();
    const accountTx = await client.request({
      command: 'account_tx',
      account: wallet,
      limit: 10
    });

    const validPayment = accountTx.result.transactions.find(tx =>
      tx.tx.TransactionType === 'Payment' &&
      tx.tx.Destination === SERVICE_WALLET &&
      tx.tx.Amount?.currency === SGLCN_CURRENCY_HEX &&
      tx.tx.Amount?.issuer === SGLCN_ISSUER &&
      parseFloat(tx.tx.Amount?.value) >= 0.5
    );

    await client.disconnect();

    if (validPayment) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'SeagullCoin payment not found or invalid.' });
    }
  } catch (err) {
    await client.disconnect();
    res.status(500).json({ error: err.message });
  }
});

// Mint NFT
app.post('/mint', upload.single('file'), async (req, res) => {
  const { name, description, wallet, domain } = req.body;
  const filePath = req.file.path;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const nftStorage = new NFTStorage({ token: NFT_STORAGE_API_KEY });

    const metadata = await nftStorage.store({
      name,
      description,
      image: new File([fileBuffer], req.file.originalname, {
        type: mime.lookup(req.file.originalname)
      }),
      properties: { domain }
    });

    await client.connect();
    const walletInstance = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED);

    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletInstance.classicAddress,
      URI: xrpl.convertStringToHex(metadata.url),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0
    };

    const prepared = await client.autofill(tx);
    const signed = walletInstance.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    fs.unlinkSync(filePath);
    await client.disconnect();

    if (result.result.meta.TransactionResult === 'tesSUCCESS') {
      const nftokenId = result.result.meta.nftoken_id || null;
      res.json({ success: true, metadata: metadata.url, nftokenId });
    } else {
      res.status(400).json({ success: false, error: result.result.meta.TransactionResult });
    }
  } catch (err) {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    await client.disconnect();
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`SGLCN-X20 Minting API running on port ${PORT}`);
});
