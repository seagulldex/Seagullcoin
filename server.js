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

// === /buy-nft endpoint ===
/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: "Buy an NFT using SeagullCoin"
 *     description: "Allows users to buy NFTs by making a payment with SeagullCoin only."
 *     parameters:
 *       - in: body
 *         name: wallet
 *         description: "The user's wallet address."
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: nftId
 *         description: "The NFT ID that the user wants to purchase."
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: price
 *         description: "The price of the NFT in SeagullCoin."
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: "NFT purchase successful"
 *       400:
 *         description: "Invalid wallet address or missing information"
 *       403:
 *         description: "Unauthorized payment (XRP is not allowed)"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/buy-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  if (!wallet || !nftId || !price) {
    return res.status(400).json({ error: 'Missing wallet address, nftId, or price' });
  }

  try {
    await xrplClient.connect();

    // Fetch transaction history to check for SeagullCoin payment
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
        parseFloat(t.Amount?.value) >= price
      );
    });

    if (!paymentTx) {
      return res.status(403).json({ error: 'Unauthorized payment: Only SeagullCoin payments are accepted' });
    }

    // Process the NFT purchase (transfer ownership, etc.)
    // Implement your logic to transfer the NFT ownership to the buyer
    console.log(`Purchasing NFT ${nftId} for ${price} SeagullCoin by ${wallet}`);

    res.status(200).json({ success: true, message: 'NFT purchased successfully' });
  } catch (err) {
    console.error('Error purchasing NFT:', err);
    res.status(500).json({ error: 'NFT purchase failed' });
  } finally {
    await xrplClient.disconnect();
  }
});

// === /sell-nft endpoint ===
/**
 * @swagger
 * /sell-nft:
 *   post:
 *     summary: "Sell an NFT for SeagullCoin"
 *     description: "Allows users to list NFTs for sale with SeagullCoin only."
 *     parameters:
 *       - in: body
 *         name: wallet
 *         description: "The user's wallet address."
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: nftId
 *         description: "The NFT ID to be listed for sale."
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: price
 *         description: "The price in SeagullCoin for the NFT."
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: "NFT listed for sale successfully"
 *       400:
 *         description: "Invalid wallet address or missing information"
 *       403:
 *         description: "Unauthorized action (XRP is not allowed)"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/sell-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  if (!wallet || !nftId || !price) {
    return res.status(400).json({ error: 'Missing wallet address, nftId, or price' });
  }

  try {
    await xrplClient.connect();

    // Ensure the offer price is set to SeagullCoin only (not XRP)
    if (price <= 0) {
      return res.status(400).json({ error: 'Price must be greater than zero' });
    }

    // Your logic to list the NFT for sale with SeagullCoin pricing
    console.log(`Listing NFT ${nftId} for sale by ${wallet} at ${price} SeagullCoin`);

    res.status(200).json({ success: true, message: 'NFT listed for sale successfully' });
  } catch (err) {
    console.error('Error listing NFT for sale:', err);
    res.status(500).json({ error: 'Failed to list NFT for sale' });
  } finally {
    await xrplClient.disconnect();
  }
});


// Mock function to simulate fetching NFT details
async function getNFTDetails(nftId) {
  // Implement your database call here to get NFT details
  return {
    nftId,
    price: 0.5, // Price in SeagullCoin (replace with your actual NFT price fetching logic)
    owner: 'existing-owner-address', // Owner address (replace with actual logic)
  };
}

const listNFTForSale = async (NFTokenID, price, seller) => {
  try {
    // Verify price is in SeagullCoin
    if (!price || price <= 0 || !Number.isFinite(price)) {
      throw new Error("Invalid price");
    }

    // Check that the seller has the NFT in their wallet
    const isNFTOwned = await checkNFTokenOwnership(seller, NFTokenID);
    if (!isNFTOwned) {
      throw new Error("NFT not owned by seller");
    }

    // Store the NFT listing in the database (e.g., MongoDB)
    const listing = {
      NFTokenID,
      price,
      seller,
      status: "listed",
      timestamp: new Date(),
    };
    await storeListingInDatabase(listing); // Placeholder for database insertion

    return listing; // Return the stored listing
  } catch (error) {
    console.error("Error listing NFT for sale:", error);
    throw new Error("Unable to list NFT for sale");
  }
};

const transferNFTOwnership = async (NFTokenID, buyer, seller, price) => {
  try {
    // Verify buyer's balance (check if they have enough SeagullCoin)
    const buyerBalance = await checkSeagullCoinBalance(buyer);
    if (buyerBalance < price) {
      throw new Error("Buyer does not have enough SeagullCoin");
    }

    // Initiate the transaction to transfer the NFT from seller to buyer
    const transferSuccess = await sendNFTokenTransferTransaction(NFTokenID, seller, buyer);
    if (!transferSuccess) {
      throw new Error("Failed to transfer NFT ownership");
    }

    // Process the payment in SeagullCoin (handling the payment transaction)
    const paymentSuccess = await processSeagullCoinPayment(buyer, seller, price);
    if (!paymentSuccess) {
      throw new Error("Payment failed");
    }

    // Update the database to reflect the sale and transfer
    await updateNFTOwnershipInDatabase(NFTokenID, buyer);

    // Optionally, mark the listing as "sold" in the database
    await markListingAsSold(NFTokenID);

    return {
      success: true,
      message: "NFT ownership transferred successfully",
    };
  } catch (error) {
    console.error("Error transferring NFT ownership:", error);
    throw new Error("Unable to transfer NFT ownership");
  }
};


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
