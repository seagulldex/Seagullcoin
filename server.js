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
import swaggerJsdoc from 'swagger-jsdoc';
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

// Mock function to simulate fetching NFT details
async function getNFTDetails(nftId) {
  // Implement your database call here to get NFT details
  return {
    nftId,
    price: 0.5, // Price in SeagullCoin (replace with your actual NFT price fetching logic)
    owner: 'existing-owner-address', // Owner address (replace with actual logic)
  };
}

// Mock function to simulate transferring NFT ownership
async function transferNFTOwnership(nftId, buyerAddress) {
  // Implement your logic to transfer ownership of the NFT (e.g., via XRPL transaction)
  console.log(`Transferring ownership of NFT ${nftId} to ${buyerAddress}`);
  // Add your actual transfer logic here
}

// Mock function to simulate listing an NFT for sale
async function listNFTForSale(nftId, sellerAddress, price) {
  // Implement your logic to list the NFT for sale (e.g., storing it in a marketplace database)
  console.log(`Listing NFT ${nftId} for sale by ${sellerAddress} at price ${price}`);
  // Add your actual listing logic here
}


// Mock function to simulate fetching a payment transaction
async function getPaymentTransaction(buyerAddress, price) {
  // Simulate fetching a payment transaction from the ledger
  return {
    Amount: {
      currency: SEAGULLCOIN_CODE,
      issuer: SEAGULLCOIN_ISSUER,
      value: price,
    },
  };
}


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

const swaggerSpec = swaggerJsdoc(options);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const xrplClient = new xrpl.Client('wss://s1.ripple.com');
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

const SEAGULLCOIN_CODE = process.env.SEAGULLCOIN_CODE;
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const BURN_WALLET = process.env.BURN_WALLET;
const MINT_COST = 0.5;
const USED_PAYMENTS = new Set(); // Consider replacing with Redis for production

// === Fetch Data with Retry Helper Function ===
async function fetchDataWithRetry(url, options, retries = 3, delay = 1000) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... ${retries} attempts left`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchDataWithRetry(url, options, retries - 1, delay);
    } else {
      throw new Error(`Fetch failed after ${3 - retries + 1} attempts: ${error.message}`);
    }
  }
}

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

// Add the necessary imports for the new functionalities
const axios = require('axios');

// POST /pay: Verify SeagullCoin payment before minting
app.post('/pay', async (req, res) => {
    const { walletAddress, amount } = req.body;

    try {
        // Make sure SeagullCoin payment has been made to the specified wallet
        const paymentInfo = await axios.get(`https://xrplapi.com/payments/${walletAddress}`);
        if (paymentInfo.data.amount >= amount) {
            res.status(200).send({ message: 'Payment verified.' });
        } else {
            res.status(400).send({ message: 'Insufficient funds for minting.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error verifying payment.' });
    }
});

// GET /user: Retrieve XUMM user wallet information
app.get('/user', async (req, res) => {
    const xummToken = req.headers['x-xumm-token'];
    if (!xummToken) {
        return res.status(400).send({ message: 'XUMM token is required.' });
    }

    try {
        // Fetch user wallet info from XUMM API
        const userData = await axios.get(`${XUMM_API_URL}/payloads/${xummToken}`, {
            headers: {
                Authorization: `Bearer ${XUMM_API_KEY}:${XUMM_API_SECRET}`,
            },
        });
        res.status(200).json(userData.data);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error fetching user data.' });
    }
});


// list-nft-for-sale route
/**
 * @swagger
 * /list-nft-for-sale:
 *   post:
 *     summary: "List an NFT for sale"
 *     description: "Allows users to list their NFTs for sale by specifying the price in SeagullCoin."
 *     tags: [NFTs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT to list
 *               price:
 *                 type: integer
 *                 description: Price in SeagullCoin
 *             required:
 *               - nftId
 *               - price
 *     responses:
 *       200:
 *         description: "NFT successfully listed for sale"
 *       400:
 *         description: "Invalid input or NFT ownership"
 *       500:
 *         description: "Internal server error"
 */

// buy-nft route
/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: "Buy an NFT"
 *     description: "Allows users to buy an NFT by providing the NFT ID and the amount in SeagullCoin."
 *     tags: [NFTs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT to buy
 *               buyerWallet:
 *                 type: string
 *                 description: The wallet address of the buyer
 *               price:
 *                 type: integer
 *                 description: The amount in SeagullCoin
 *             required:
 *               - nftId
 *               - buyerWallet
 *               - price
 *     responses:
 *       200:
 *         description: "NFT successfully purchased"
 *       400:
 *         description: "Invalid input or insufficient funds"
 *       500:
 *         description: "Internal server error"
 */

// nfts route
/**
 * @swagger
 * /nfts:
 *   get:
 *     summary: "Get all NFTs"
 *     description: "Fetches all NFTs that have been minted on the platform."
 *     tags: [NFTs]
 *     responses:
 *       200:
 *         description: "A list of NFTs"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   nftId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   creator:
 *                     type: string
 *                   price:
 *                     type: integer
 *       500:
 *         description: "Internal server error"
 */

// collections route
/**
 * @swagger
 * /collections:
 *   get:
 *     summary: "Get all NFT collections"
 *     description: "Fetches all NFT collections available on the platform."
 *     tags: [NFTs]
 *     responses:
 *       200:
 *         description: "A list of NFT collections"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   collectionId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   logo:
 *                     type: string
 *       500:
 *         description: "Internal server error"
 */


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

// === /cancel-xrp-offers endpoint ===
/**
 * @swagger
 * /cancel-xrp-offers:
 *   post:
 *     summary: "Cancel unauthorized XRP offers"
 *     description: "Automatically cancels any unauthorized XRP-based offers for SeagullCoin NFTs."
 *     parameters:
 *       - in: body
 *         name: wallet
 *         description: "The user's wallet address."
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Offers canceled successfully"
 *       400:
 *         description: "Invalid wallet address"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/cancel-xrp-offers', async (req, res) => {
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  try {
    await xrplClient.connect();
    const offers = await xrplClient.request({
      command: 'account_nfts',
      account: wallet,
    });

    // Filter out offers made in XRP (we only want SeagullCoin offers)
    const xrpOffers = offers.result.filter((offer) => {
      return (
        offer?.Amount?.currency === 'XRP'
      );
    });

    if (xrpOffers.length > 0) {
      const cancelTxs = xrpOffers.map((offer) => {
        return {
          TransactionType: 'NFTokenCancelOffer',
          Account: wallet,
          NFTokenID: offer.NFTokenID,
        };
      });

      // Submit cancellation transactions for each XRP offer
      for (let cancelTx of cancelTxs) {
        const preparedTx = await xrplClient.autofill(cancelTx);
        const signedTx = wallet.sign(preparedTx);
        await xrplClient.submit(signedTx.tx_blob);
      }
    }

    res.status(200).json({ success: true, message: 'Canceled unauthorized XRP offers' });
  } catch (err) {
    console.error('Error canceling XRP offers:', err);
    res.status(500).json({ error: 'Failed to cancel XRP offers' });
  } finally {
    await xrplClient.disconnect();
  }
});

// Start the API server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});


