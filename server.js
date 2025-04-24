import express from 'express';
import bodyParser from 'body-parser';
import xrpl from 'xrpl';
import fetch from 'node-fetch';  // Added this line
import session from 'express-session';
import { XummSdk } from 'xumm-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

const app = express();

// ES Module Compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(
  session({
    secret: 'seagullcoin-secret',
    resave: false,
    saveUninitialized: true,
  })
);

// Rate-Limiting Middleware (100 requests per hour per IP)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 requests per hour
  message: 'Too many requests, please try again later.',
});

app.use(limiter);

const xrplClient = new xrpl.Client('wss://s1.ripple.com');
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

const SEAGULLCOIN_CODE = process.env.SEAGULLCOIN_CODE;
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const BURN_WALLET = process.env.BURN_WALLET;
const MINT_COST = 0.5;
const USED_PAYMENTS = new Set(); // Consider replacing with Redis for production

// === Home Route ===
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the SGLCN-X20 NFT Minting API!' });
});

// === XUMM Login ===
app.get('/login', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' },
    });
    req.session.xummPayloadUuid = payload.uuid;

    const walletAddress = payload?.meta?.account;
    req.session.walletAddress = walletAddress;

    console.log('XUMM login successful. Wallet address:', walletAddress);

    res.json({ qr: payload.refs.qr_png, uuid: payload.uuid });
  } catch (err) {
    console.error('Error during XUMM login:', err);
    res.status(500).json({ error: 'Failed to create login payload' });
  }
});

// === Mint NFT ===
async function mintNFT(wallet, nftData) {
  const metadata = {
    name: nftData.name,
    description: nftData.description,
    image: nftData.image,
    attributes: nftData.attributes || [],
    collection: nftData.collection || null,
  };

  try {
    const metadataRes = await fetch('https://api.nft.storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!metadataRes.ok) {
      throw new Error('Failed to upload metadata to IPFS');
    }

    const metadataJson = await metadataRes.json();
    const ipfsUrl = `https://ipfs.io/ipfs/${metadataJson.value.cid}`;

    console.log('Metadata uploaded to IPFS:', ipfsUrl);

    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      URI: xrpl.convertStringToHex(ipfsUrl),
      Flags: 0,
      TokenTaxon: 0,
      TransferFee: 0,
    };

    const preparedTx = await xrplClient.autofill(mintTx);
    const signedTx = wallet.sign(preparedTx);
    const txResult = await xrplClient.submit(signedTx.tx_blob);
    const nftTokenId = txResult.result.tx_json?.NFTokenID;

    return {
      nftTokenId,
      ipfsUrl,
      collection: nftData.collection || 'No Collection',
      mintTxHash: txResult.result.hash,
    };
  } catch (err) {
    console.error('Error during minting process:', err);
    throw err;
  }
}

// === /mint endpoint ===
app.post('/mint', async (req, res) => {
  const { wallet, nftData } = req.body;

  // Ensure user is logged in and wallet matches session
  if (!req.session.walletAddress || req.session.walletAddress !== wallet) {
    return res.status(401).json({ error: 'Unauthorized: Wallet mismatch or not logged in via XUMM' });
  }

  // Ensure wallet and nftData are provided
  if (!wallet || !nftData) {
    return res.status(400).json({ error: 'Missing wallet or NFT data' });
  }

  try {
    await xrplClient.connect();

    // Fetch recent transactions for the user's wallet
    const txs = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1000,
      ledger_index_max: -1,
      limit: 30,
    });

    // Find a valid SeagullCoin payment transaction
    const paymentTx = txs.result.transactions.find((tx) => {
      const t = tx.tx;
      return (
        tx.validated &&
        t.TransactionType === 'Payment' && // Check it's a Payment transaction
        t.Destination === BURN_WALLET && // Payment must go to the burn wallet
        t.Amount?.currency === SEAGULLCOIN_CODE && // SeagullCoin must be the currency
        t.Amount?.issuer === SEAGULLCOIN_ISSUER && // SeagullCoin issuer must match
        parseFloat(t.Amount?.value) >= MINT_COST && // Payment must be at least 0.5 SeagullCoin
        !USED_PAYMENTS.has(t.hash) // Ensure we haven't already used this payment
      );
    });

    // If no valid payment found
    if (!paymentTx) {
      return res.status(403).json({ success: false, error: 'No valid SeagullCoin payment found for minting' });
    }

    // Mark this payment as used to prevent duplicates
    USED_PAYMENTS.add(paymentTx.tx.hash);

    // Proceed with minting the NFT
    const mintResult = await mintNFT(wallet, nftData);
    res.status(200).json({
      success: true,
      nftTokenId: mintResult.nftTokenId,
      ipfsUrl: mintResult.ipfsUrl,
      collection: mintResult.collection,
      mintTxHash: mintResult.mintTxHash,
      paymentTxHash: paymentTx.tx.hash,
    });
  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ error: 'Minting failed internally' });
  } finally {
    await xrplClient.disconnect();
  }
});

// === /buy-nft endpoint ===
app.post('/buy-nft', async (req, res) => {
  const { nftTokenId, wallet } = req.body;

  // Ensure user is logged in and wallet matches session
  if (!req.session.walletAddress || req.session.walletAddress !== wallet) {
    return res.status(401).json({ error: 'Unauthorized: Wallet mismatch or not logged in via XUMM' });
  }

  // Ensure nftTokenId and wallet are provided
  if (!nftTokenId || !wallet) {
    return res.status(400).json({ error: 'Missing nftTokenId or wallet' });
  }

  try {
    await xrplClient.connect();

    // Fetch recent transactions for the user's wallet
    const txs = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1000,
      ledger_index_max: -1,
      limit: 30,
    });

    // Find a valid SeagullCoin payment transaction
    const paymentTx = txs.result.transactions.find((tx) => {
      const t = tx.tx;
      return (
        tx.validated &&
        t.TransactionType === 'Payment' && // Check it's a Payment transaction
        t.Amount?.currency === SEAGULLCOIN_CODE && // SeagullCoin must be the currency
        t.Amount?.issuer === SEAGULLCOIN_ISSUER && // SeagullCoin issuer must match
        parseFloat(t.Amount?.value) >= MINT_COST && // Payment must be at least 0.5 SeagullCoin
        !USED_PAYMENTS.has(t.hash) // Ensure we haven't already used this payment
      );
    });

    // If no valid payment found
    if (!paymentTx) {
      return res.status(403).json({ success: false, error: 'No valid SeagullCoin payment found for purchase' });
    }

    // Mark this payment as used to prevent duplicates
    USED_PAYMENTS.add(paymentTx.tx.hash);

    // Proceed with buying the NFT (your specific buy logic will go here)

    res.status(200).json({
      success: true,
      message: 'NFT purchase successful',
      paymentTxHash: paymentTx.tx.hash,
    });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'NFT purchase failed internally' });
  } finally {
    await xrplClient.disconnect();
  }
});

// Server start
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
