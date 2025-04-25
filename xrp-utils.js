const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const dotenv = require('dotenv');
const { XummSdk } = require('xumm-sdk');
const axios = require('axios');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize XUMM SDK
const xumm = new XummSdk({
  apiKey: process.env.XUMM_API_KEY,
  secretKey: process.env.XUMM_SECRET_KEY,
});

// SeagullCoin information
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const SEAGULLCOIN_CURRENCY = 'SeagullCoin';

// Basic API documentation configuration using Swagger JSDoc
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SeagullCoin NFT Minting API',
      version: '1.0.0',
      description: 'API documentation for the SeagullCoin NFT minting platform.',
    },
  },
  apis: ['./server.js'],  // Files to scan for JSDoc comments (you can add more files if needed)
};

const specs = swaggerJsdoc(options);

// Serve Swagger API docs at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

// Middleware to ensure SeagullCoin balance for minting
async function checkSeagullCoinBalance(walletAddress) {
  try {
    const response = await axios.get(`https://data.ripple.com/v2/accounts/${walletAddress}/balances`);
    const balances = response.data.result;
    const seagullCoinBalance = balances.find(b => b.currency === SEAGULLCOIN_CURRENCY && b.issuer === SEAGULLCOIN_ISSUER);
    return seagullCoinBalance ? parseFloat(seagullCoinBalance.value) : 0;
  } catch (error) {
    console.error('Error checking SeagullCoin balance:', error);
    return 0;
  }
}

// Minting Endpoint (SeagullCoin Only)
app.post('/mint', express.json(), async (req, res) => {
  const { walletAddress, metadata } = req.body;

  if (!walletAddress || !metadata) {
    return res.status(400).send({ error: 'Missing walletAddress or metadata' });
  }

  // Check SeagullCoin balance before proceeding with minting
  const balance = await checkSeagullCoinBalance(walletAddress);

  if (balance < 0.5) {
    return res.status(400).send({ error: 'Insufficient SeagullCoin balance. You need at least 0.5 SeagullCoin to mint.' });
  }

  // Proceed with minting (Logic for creating the NFT and storing in metadata)
  // Assuming you have the minting logic here, like adding to NFT.Storage, etc.

  // Example response
  res.send({ message: 'Minting successful, NFT created!' });
});

// Buying NFTs (SeagullCoin Only)
app.post('/buy-nft', express.json(), async (req, res) => {
  const { walletAddress, nftId } = req.body;

  if (!walletAddress || !nftId) {
    return res.status(400).send({ error: 'Missing walletAddress or nftId' });
  }

  // Check SeagullCoin balance before processing the purchase
  const balance = await checkSeagullCoinBalance(walletAddress);

  if (balance < 0.5) {
    return res.status(400).send({ error: 'Insufficient SeagullCoin balance to buy NFT.' });
  }

  // Proceed with the buying logic (XUMM or transaction on the XRPL)
  // You should call XUMM or your transaction logic here

  res.send({ message: 'NFT purchased successfully!' });
});

// Selling NFTs (SeagullCoin Only)
app.post('/sell-nft', express.json(), async (req, res) => {
  const { walletAddress, nftId, price } = req.body;

  if (!walletAddress || !nftId || !price) {
    return res.status(400).send({ error: 'Missing walletAddress, nftId, or price' });
  }

  // Check SeagullCoin balance before processing the sale
  const balance = await checkSeagullCoinBalance(walletAddress);

  if (balance < price) {
    return res.status(400).send({ error: 'Insufficient SeagullCoin balance for sale.' });
  }

  // Proceed with the selling logic (XUMM or transaction on the XRPL)
  // You should call XUMM or your transaction logic here

  res.send({ message: 'NFT sale successful!' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
