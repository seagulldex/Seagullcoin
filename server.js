import express from 'express';
import bodyParser from 'body-parser';
import xrpl from 'xrpl';
import fetch from 'node-fetch';
import session from 'express-session';
import { XummSdk } from 'xumm-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

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
  message: {
    error: 'Too many requests, please try again later.',
    statusCode: 429,
  },
});

app.use(limiter);

// Swagger setup
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SGLCN-X20 Minting API',
    version: '1.0.0',
    description: 'API for minting and managing SeagullCoin NFTs',
  },
  servers: [
    {
      url: 'https://sglcn-x20-api.glitch.me',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./server.js'], // Path to the API specs
};

const swaggerSpec = swaggerJSDoc(options);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
    res.json({ qr: payload.refs.qr_png, uuid: payload.uuid });
  } catch (err) {
    console.error('Error during XUMM login:', err);
    res.status(500).json({ error: 'Failed to create login payload' });
  }
});

// === Mint NFT ===
async function mintNFT(wallet, nftData) {
  if (!nftData.name || !nftData.description || !nftData.image) {
    throw new Error('Missing required NFT data: name, description, or image');
  }

  const metadata = {
    name: nftData.name,
    description: nftData.description,
    image: nftData.image,
    attributes: nftData.attributes || [],
    collection: nftData.collection || null,
  };

  try {
    const metadataRes = await fetchDataWithRetry('https://api.nft.storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    const metadataJson = metadataRes;
    const ipfsUrl = `https://ipfs.io/ipfs/${metadataJson.value.cid}`;

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
/**
 * @swagger
 * /mint:
 *   post:
 *     summary: "Mint an NFT using SeagullCoin"
 *     description: "Allows users to mint NFTs after confirming SeagullCoin payment."
 *     parameters:
 *       - in: body
 *         name: wallet
 *         description: "The user's wallet address."
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: nftData
 *         description: "NFT metadata including name, description, etc."
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             description:
 *               type: string
 *             image:
 *               type: string
 *             attributes:
 *               type: array
 *               items:
 *                 type: object
 *             collection:
 *               type: string
 *     responses:
 *       200:
 *         description: "Minting successful"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 nftTokenId:
 *                   type: string
 *                 mintTxHash:
 *                   type: string
 *       401:
 *         description: "Unauthorized"
 *       403:
 *         description: "Forbidden - Payment not found"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/mint', async (req, res) => {
  const { wallet, nftData } = req.body;

  if (!req.session.walletAddress || req.session.walletAddress !== wallet) {
    return res.status(401).json({ error: 'Unauthorized: Wallet mismatch or not logged in via XUMM' });
  }

  if (!wallet || !nftData) {
    return res.status(400).json({ error: 'Missing wallet or NFT data' });
  }

  try {
    await xrplClient.connect();
    const txs = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1000,
      ledger_index_max: -1,
      limit: 30,
    });

    const paymentTx = txs.result.transactions.find((tx) => {
      const t = tx.tx;
      return (
        tx.validated &&
        t.TransactionType === 'Payment' &&
        t.Destination === BURN_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= MINT_COST &&
        !USED_PAYMENTS.has(t.hash)
      );
    });

    if (!paymentTx) {
      return res.status(403).json({ success: false, error: 'No valid SeagullCoin payment found for minting' });
    }

    USED_PAYMENTS.add(paymentTx.tx.hash);
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

// === /status/:transactionHash endpoint ===
app.get('/status/:transactionHash', async (req, res) => {
  const { transactionHash } = req.params;

  try {
    await xrplClient.connect();
    const txStatus = await xrplClient.request({
      command: 'tx',
      transaction: transactionHash,
    });

    if (txStatus.result.engine_result === 'tesSUCCESS') {
      return res.json({
        success: true,
        status: 'Transaction successful',
        transaction: txStatus.result,
      });
    } else {
      return res.json({
        success: false,
        status: 'Transaction failed',
        error: txStatus.result.engine_result_message,
      });
    }
  } catch (err) {
    console.error('Error fetching transaction status:', err);
    res.status(500).json({ error: 'Error fetching transaction status' });
  } finally {
    await xrplClient.disconnect();
  }
});

// === /buy-nft endpoint ===
app.post('/buy-nft', async (req, res) => {
  // Simplified logic for demonstration
  const { nftTokenId, amount, wallet } = req.body;

  if (!wallet || !nftTokenId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Process buying the NFT (You could add offer creation and validation here)
    const offerTx = await xrplClient.submit(wallet, nftTokenId, amount);
    res.json({ success: true, transactionHash: offerTx.hash });
  } catch (err) {
    console.error('Error buying NFT:', err);
    res.status(500).json({ error: 'Error buying NFT' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
