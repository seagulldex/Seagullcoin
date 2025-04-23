const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const xrpl = require('xrpl');
const dotenv = require('dotenv');
const { NFTStorage, File } = require('nft.storage');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SERVICE_SECRET = process.env.SERVICE_SECRET;
const SEAGULLCOIN_CODE = "SeagullCoin";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_COST = "0.5";
const BURN_WALLET = "r9ByKdPsDznUPPEsmLKvjPdS5qfBSWHEBL";
const xrplClient = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

/* Swagger setup */
const swaggerSpec = swaggerJsdoc({
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'SGLCN-X20 Minting API',
      version: '1.0.0',
      description: 'Public API for minting NFTs using SeagullCoin (X20) on XRPL.',
    },
    servers: [{ url: 'https://sglcn-x20-api.glitch.me' }], // Updated to Glitch URL
  },
  apis: ['./server.js'],
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Root endpoint
 *     responses:
 *       200:
 *         description: Welcome message
 */
app.get('/', (req, res) => {
  res.json({ status: "live", message: "Welcome to the SGLCN-X20 NFT Minting API!" });
});

/**
 * @swagger
 * /pay:
 *   post:
 *     summary: Verify payment of 0.5 SeagullCoin to burn wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified
 */
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ success: false, error: 'Missing wallet address' });

  try {
    await xrplClient.connect();
    const txs = await xrplClient.request({ command: 'account_tx', account: wallet, ledger_index_min: -1, ledger_index_max: -1, limit: 20 });
    const match = txs.result.transactions.find(({ tx }) =>
      tx.TransactionType === 'Payment' &&
      tx.Destination === BURN_WALLET &&
      tx.Amount?.currency === SEAGULLCOIN_CODE &&
      tx.Amount?.issuer === SEAGULLCOIN_ISSUER &&
      parseFloat(tx.Amount?.value) >= parseFloat(MINT_COST)
    );

    if (!match) return res.status(403).json({ success: false, error: 'Payment not found' });
    res.json({ success: true, txHash: match.tx.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    xrplClient.disconnect();
  }
});

/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint NFT after SeagullCoin payment and XUMM auth
 */
app.post('/mint', async (req, res) => {
  const { wallet, metadata, xummPayload } = req.body;
  if (!wallet || !metadata || !xummPayload) return res.status(400).json({ success: false, error: 'Missing data' });

  try {
    const auth = await axios.get(`https://xumm.app/api/v1/platform/payload/${xummPayload}`, {
      headers: { Authorization: `Bearer ${process.env.XUMM_API_KEY}` }
    });
    if (!auth.data?.authenticated || auth.data?.user.wallet !== wallet)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const file = new File([JSON.stringify(metadata)], 'metadata.json', { type: 'application/json' });
    const cid = await nftStorageClient.storeBlob(file);
    const result = await mintNFT(wallet, metadata, cid);
    res.json({ success: true, nft: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: Purchase an NFT using SeagullCoin only
 */
app.post('/buy-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;
  if (!wallet || !nftId || !price) return res.status(400).json({ success: false, error: 'Missing data' });

  if (!isSeagullCoin(price)) return res.status(403).json({ success: false, error: 'Only SeagullCoin accepted' });

  try {
    const result = await handleNFTPurchase(wallet, nftId, price);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @swagger
 * /sell-nft:
 *   post:
 *     summary: List an NFT for sale (SeagullCoin only)
 */
app.post('/sell-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;
  if (!wallet || !nftId || !price) return res.status(400).json({ success: false, error: 'Missing data' });

  if (!isSeagullCoin(price)) return res.status(403).json({ success: false, error: 'Only SeagullCoin accepted' });

  try {
    const result = await listNFTForSale(wallet, nftId, price);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @swagger
 * /burn:
 *   post:
 *     summary: Burn an NFT by transferring to burn wallet
 */
app.post('/burn', async (req, res) => {
  const { nftId } = req.body;
  if (!nftId) return res.status(400).json({ success: false, error: 'Missing NFT ID' });

  try {
    const result = await burnNFT(nftId);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @swagger
 * /user/{wallet}:
 *   get:
 *     summary: Get NFTs and transactions for a wallet
 */
app.get('/user/:wallet', async (req, res) => {
  try {
    const result = await getUserData(req.params.wallet);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @swagger
 * /collections:
 *   get:
 *     summary: Return all NFT collections
 */
app.get('/collections', async (req, res) => {
  try {
    const collections = await getCollections();
    res.json({ success: true, collections });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Helpers
function isSeagullCoin(amount) {
  return typeof amount === 'object' &&
    amount.currency === SEAGULLCOIN_CODE &&
    amount.issuer === SEAGULLCOIN_ISSUER;
}

async function mintNFT(wallet, metadata, cid) {
  return { wallet, cid, metadata, minted: true };
}
async function handleNFTPurchase(wallet, nftId, price) {
  return { wallet, nftId, price, transferred: true };
}
async function listNFTForSale(wallet, nftId, price) {
  return { wallet, nftId, price, listed: true };
}
async function burnNFT(nftId) {
  return { nftId, burned: true };
}
async function getUserData(wallet) {
  return { wallet, nfts: [] };
}
async function getCollections() {
  return [];
}

app.listen(PORT, () => {
  console.log(`SGLCN-X20-API running on https://sglcn-x20-api.glitch.me — Swagger docs at /docs`);
});
