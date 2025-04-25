








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

// === /check-ownership endpoint ===
/**
 * @swagger
 * /check-ownership:
 *   get:
 *     summary: "Check NFT Ownership"
 *     description: "Check whether a user owns a specific NFT."
 *     tags: [NFTs]
 *     parameters:
 *       - in: query
 *         name: nftId
 *         description: "NFT ID to check ownership for"
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: wallet
 *         description: "Wallet address of the user"
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Ownership verified"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 owned:
 *                   type: boolean
 *                   description: "True if the wallet owns the NFT"
 *       400:
 *         description: "Invalid input"
 *       500:
 *         description: "Internal Server Error"
 */
app.get('/check-ownership', async (req, res) => {
  const { nftId, wallet } = req.query;
  
  if (!nftId || !wallet) {
    return res.status(400).json({ error: 'Missing nftId or wallet parameter' });
  }

  try {
    const nftOwner = await getNFTOwner(nftId); // Replace with actual method to get owner of the NFT from ledger or database
    const owned = nftOwner === wallet;

    res.status(200).json({ owned });
  } catch (err) {
    console.error('Error checking ownership:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// === /metrics endpoint ===
/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: "Retrieve platform usage statistics"
 *     description: "Get the platform's usage statistics, such as the number of NFTs minted and transactions processed."
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: "Platform metrics retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalNftsMinted:
 *                   type: integer
 *                   description: "Total number of NFTs minted"
 *                 totalTransactionsProcessed:
 *                   type: integer
 *                   description: "Total number of transactions processed"
 *       500:
 *         description: "Internal Server Error"
 */
app.get('/metrics', async (req, res) => {
  try {
    // Fetch platform metrics (replace with actual data gathering logic)
    const metrics = await getPlatformMetrics();
    res.status(200).json(metrics);
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve platform metrics' });
  }
});

// Mock function to get platform metrics (replace with actual implementation)
async function getPlatformMetrics() {
  // Example logic to gather platform statistics
  const totalNftsMinted = 1000; // Replace with actual logic to fetch the total number of NFTs minted
  const totalTransactionsProcessed = 2500; // Replace with actual logic to count the number of transactions

  return {
    totalNftsMinted,
    totalTransactionsProcessed,
  };
}

// === /login endpoint ===
/**
 * @swagger
 * /login:
 *   post:
 *     summary: "User login"
 *     description: "Authenticates the user by verifying their XUMM wallet address."
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: "The XUMM wallet address to authenticate."
 *                 example: "rEXAMPLE1234567890"
 *     responses:
 *       200:
 *         description: "User successfully authenticated"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 wallet:
 *                   type: string
 *                   example: "rEXAMPLE1234567890"
 *       400:
 *         description: "Invalid input"
 *       401:
 *         description: "Unauthorized: Invalid wallet address"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/login', async (req, res) => {
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  try {
    // Verify the wallet address (replace with actual XUMM API validation logic)
    const isValidWallet = await validateWalletAddress(wallet);

    if (!isValidWallet) {
      return res.status(401).json({ error: 'Invalid wallet address' });
    }

    // Store the wallet address in the session or JWT token
    req.session.walletAddress = wallet;

    // Respond with a success message
    res.status(200).json({
      message: 'Login successful',
      wallet: wallet,
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mock function to validate wallet address (replace with actual XUMM API logic)
async function validateWalletAddress(wallet) {
  // Example validation (replace with actual validation logic, e.g., via XUMM API)
  const validWallets = ['rEXAMPLE1234567890', 'rEXAMPLE0987654321']; // Replace with actual valid wallet check

  return validWallets.includes(wallet); // Replace with your actual wallet verification logic
}



// Mock function to get NFT owner (replace with actual implementation)
async function getNFTOwner(nftId) {
  // Example logic to fetch the NFT owner
  return 'rWalletAddress'; // Replace this with the actual owner address logic
}

// === /transfer-nft endpoint ===
/**
 * @swagger
 * /transfer-nft:
 *   post:
 *     summary: "Transfer NFT Ownership"
 *     description: "Transfers an NFT to another wallet address."
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
 *               toWallet:
 *                 type: string
 *     responses:
 *       200:
 *         description: "NFT successfully transferred"
 *       400:
 *         description: "Invalid input or NFT ownership"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/transfer-nft', async (req, res) => {
  const { nftId, toWallet } = req.body;

  if (!nftId || !toWallet) {
    return res.status(400).json({ error: 'Missing nftId or toWallet' });
  }

  try {
    // Get the current owner of the NFT
    const nftOwner = await getNFTOwner(nftId); // Replace with actual method to get owner of the NFT from ledger or database

    // Ensure the current user is the owner of the NFT
    if (nftOwner !== req.session.walletAddress) {
      return res.status(400).json({ error: 'You are not the owner of this NFT' });
    }

    // Transfer the NFT (implement actual transfer logic here, e.g., XRPL transaction)
    const transferResult = await transferNFTOwnership(nftId, toWallet);
    res.status(200).json({ message: 'NFT transferred successfully', transferResult });
  } catch (err) {
    console.error('Error transferring NFT:', err);
    res.status(500).json({ error: 'Failed to transfer NFT' });
  }
});

// Mock function to transfer NFT ownership (replace with actual implementation)
async function transferNFTOwnership(nftId, toWallet) {
  // Example logic to transfer NFT ownership (this would be an XRPL transaction or database update)
  console.log(`Transferring NFT ${nftId} to ${toWallet}`);
  return { nftId, toWallet }; // Return result or success status
}

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
    // Get the offers from the marketplace (replace with actual logic)
    const offers = await getXRPOffers(wallet); // Replace with actual logic to fetch XRP offers

    // Loop through the offers and cancel the unauthorized ones
    const cancelledOffers = [];
    for (const offer of offers) {
      if (offer.currency === 'XRP') {
        // Cancel the offer (replace with actual logic to cancel offers)
        await cancelOffer(offer);
        cancelledOffers.push(offer);
      }
    }

    res.status(200).json({ message: 'Unauthorized XRP offers cancelled', cancelledOffers });
  } catch (err) {
    console.error('Error cancelling XRP offers:', err);
    res.status(500).json({ error: 'Failed to cancel offers' });
  }
});

// Mock function to get XRP offers (replace with actual implementation)
async function getXRPOffers(wallet) {
  // Example logic to fetch XRP offers for the wallet
  return [
    { offerId: '123', currency: 'XRP', amount: 50 },
    { offerId: '124', currency: 'SGLCN-X20', amount: 100 },
  ]; // Return mock data for testing
}

// Mock function to cancel an offer (replace with actual implementation)
async function cancelOffer(offer) {
  console.log(`Cancelling offer with ID ${offer.offerId}`);
  // Replace with actual logic to cancel offer (e.g., XRPL cancel transaction)
}

// Mock function to simulate fetching NFT details
async function getNFTDetails(nftId) {
  // Implement your database call here to get NFT details
  return {
    nftId,
    price: 0.5, // Price in SeagullCoin (replace with your actual NFT price fetching logic)
    owner: 'existing-owner-address', // Owner address (replace with actual logic)
  };
}

app.get('/get/nfts/search', async (req, res) => {
  const { name, collectionId, minPrice, maxPrice, owner, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

  try {
    // Build the search criteria based on the query parameters
    const searchCriteria = {
      name,
      collectionId,
      minPrice: parseFloat(minPrice),
      maxPrice: parseFloat(maxPrice),
      owner,
    };

    // Call the searchNFTs function with pagination, sorting, and filtering
    const searchResults = await searchNFTs({
      searchCriteria,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    // Return the search results as a response
    res.status(200).json({
      nfts: searchResults.nfts,
      total: searchResults.total,
      page: searchResults.page,
      limit: searchResults.limit,
    });
  } catch (err) {
    console.error('Error searching NFTs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Modify the searchNFTs function to include sorting and pagination logic
async function searchNFTs({ searchCriteria, sortBy, sortOrder, page, limit }) {
  // Mock NFT database query, normally you'd query a database here
  let nfts = [
    { nftId: '12345', name: 'Seagull NFT #12345', description: 'A rare SeagullCoin NFT', collectionId: '6789', price: 0.5, owner: 'rwXYHjcLfVoe43kAhg3k2xx5EsJf9gSeAG', date: '2023-01-01T00:00:00Z' },
    { nftId: '12346', name: 'Seagull NFT #12346', description: 'Another SeagullCoin NFT', collectionId: '6789', price: 0.3, owner: 'rwXYHjcLfVoe43kAhg3k2xx5EsJf9gSeAG', date: '2023-02-01T00:00:00Z' },
    { nftId: '12347', name: 'Seagull NFT #12347', description: 'Limited edition SeagullCoin NFT', collectionId: '6790', price: 0.8, owner: 'rwXYHjcLfVoe43kAhg3k2xx5EsJf9gSeAG', date: '2023-03-01T00:00:00Z' },
  ];

  // Filter NFTs based on search criteria
  if (searchCriteria.name) {
    nfts = nfts.filter(nft => nft.name.toLowerCase().includes(searchCriteria.name.toLowerCase()));
  }
  if (searchCriteria.collectionId) {
    nfts = nfts.filter(nft => nft.collectionId === searchCriteria.collectionId);
  }
  if (searchCriteria.minPrice) {
    nfts = nfts.filter(nft => nft.price >= searchCriteria.minPrice);
  }
  if (searchCriteria.maxPrice) {
    nfts = nfts.filter(nft => nft.price <= searchCriteria.maxPrice);
  }
  if (searchCriteria.owner) {
    nfts = nfts.filter(nft => nft.owner === searchCriteria.owner);
  }

  // Sort NFTs based on the provided sort criteria
  if (sortBy && sortOrder) {
    nfts = nfts.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'price') {
        comparison = a.price - b.price;
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'date') {
        comparison = new Date(a.date) - new Date(b.date);
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // Pagination: Slice the results based on the page and limit
  const offset = (page - 1) * limit;
  const paginatedResults = nfts.slice(offset, offset + limit);

  return {
    nfts: paginatedResults,
    total: nfts.length,
    page,
    limit,
  };
}

app.get('/get/nft/:nftId', async (req, res) => {
  const { nftId } = req.params;
  try {
    const nftDetails = await getNFTDetails(nftId);
    res.status(200).json(nftDetails);
  } catch (err) {
    console.error('Error fetching NFT details:', err);
    res.status(500).json({ error: 'Failed to fetch NFT details' });
  }
});

app.get('/get/user/offers', async (req, res) => {
  const userWallet = req.query.wallet;
  try {
    const userOffers = await getUserOffers(userWallet);
    res.status(200).json(userOffers);
  } catch (err) {
    console.error('Error fetching user offers:', err);
    res.status(500).json({ error: 'Failed to fetch user offers' });
  }
});

async function getUserOffers(wallet) {
  // Mock function to get offers based on user wallet address
  return [
    { offerId: 'offer123', nftId: '12345', price: 0.5, status: 'pending' },
  ];
}

app.post('/update-nft-metadata', async (req, res) => {
  const { nftId, metadata } = req.body;
  try {
    // Implement your logic to update the NFT's metadata on XRPL or IPFS
    console.log(`Updating metadata for NFT with ID: ${nftId}`);
    res.status(200).json({ message: 'NFT metadata updated successfully' });
  } catch (err) {
    console.error('Error updating NFT metadata:', err);
    res.status(500).json({ error: 'Failed to update NFT metadata' });
  }
});

app.post('/cancel-offer', async (req, res) => {
  const { offerId, buyerWallet } = req.body;
  try {
    // Implement your logic to cancel the offer (e.g., remove from marketplace)
    console.log(`Canceling offer with ID: ${offerId}`);
    res.status(200).json({ message: 'Offer canceled successfully' });
  } catch (err) {
    console.error('Error canceling offer:', err);
    res.status(500).json({ error: 'Failed to cancel offer' });
  }
});

app.delete('/delete-nft', async (req, res) => {
  const { nftId, wallet } = req.body;
  try {
    // Implement your logic to delete or burn the NFT (e.g., via XRPL)
    console.log(`Burning or deleting NFT with ID: ${nftId}`);
    res.status(200).json({ message: 'NFT deleted successfully' });
  } catch (err) {
    console.error('Error deleting NFT:', err);
    res.status(500).json({ error: 'Failed to delete NFT' });
  }
});

app.get('/nft-history', async (req, res) => {
  const { nftId } = req.query;
  // Return transaction history
});

app.get('/get/nft/offers/:nftId', async (req, res) => {
  const { nftId } = req.params;
  try {
    const offers = await getNFTOffers(nftId);
    res.status(200).json(offers);
  } catch (err) {
    console.error('Error fetching offers for NFT:', err);
    res.status(500).json({ error: 'Failed to fetch offers for NFT' });
  }
});

async function getNFTOffers(nftId) {
  // Mock function to get offers for a specific NFT
  return [
    { offerId: 'offer123', buyer: 'rwXYHjcLfVoe43kAhg3k2xx5EsJf9gSeAG', price: 0.5 },
  ];
}



app.put('/update-nft', async (req, res) => {
  const { nftId, updatedMetadata } = req.body;
  // Validate and update the metadata on NFT.Storage or XRPL
});


app.get('/get/nfts', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    const nftList = await getNFTList({ offset, limit });
    const totalNFTs = await getTotalNFTsCount();

    res.status(200).json({
      nfts: nftList,
      total: totalNFTs,
      page,
      limit,
    });
  } catch (err) {
    console.error('Error fetching NFTs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function getNFTList({ offset, limit }) {
  // Mock database query logic to fetch NFTs based on pagination
  return [
    { nftId: '12345', name: 'Seagull NFT #12345' },
    { nftId: '12346', name: 'Seagull NFT #12346' },
  ];
}

async function getTotalNFTsCount() {
  // Mock function to count total NFTs
  return 100;
}

app.get('/get/collections/search', async (req, res) => {
  const { name, description } = req.query;

  try {
    const searchResults = await searchCollections({ name, description });
    res.status(200).json(searchResults);
  } catch (err) {
    console.error('Error searching collections:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function searchCollections({ name, description }) {
  // Mock search function
  return [
    { collectionId: '6789', name: 'SeagullCoin Collection', description: 'A collection of SeagullCoin NFTs' },
  ];
}

app.get('/check-ownership', async (req, res) => {
  const { nftId, wallet } = req.query;
  // Validate ownership
});


app.get('/get/user/nfts', async (req, res) => {
  const userWallet = req.query.wallet; // Assume wallet address is passed as a query parameter

  try {
    const userNFTs = await getUserNFTs(userWallet);
    res.status(200).json(userNFTs);
  } catch (err) {
    console.error('Error fetching user NFTs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function getUserNFTs(wallet) {
  // Mock function to get NFTs based on user wallet address
  return [
    { nftId: '12345', name: 'Seagull NFT #12345', owner: wallet },
  ];
}

app.post('/offer-nft-sale', async (req, res) => {
  const { nftId, sellerWallet, price } = req.body;
  try {
    await listNFTForSale(nftId, sellerWallet, price);
    res.status(200).json({ message: 'NFT listed for sale successfully' });
  } catch (err) {
    console.error('Error listing NFT for sale:', err);
    res.status(500).json({ error: 'Failed to list NFT for sale' });
  }
});


app.post('/transfer-nft', async (req, res) => {
  const { nftId, toWallet } = req.body;
  // Validate and transfer NFT ownership
});


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