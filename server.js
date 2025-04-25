// server.js

require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { XummSdk } = require('xumm-sdk');
const { Client } = require('xrpl');

const app = express();
const port = process.env.PORT || 3000;

// Initialize XUMM SDK
const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_SECRET_KEY = process.env.XUMM_SECRET_KEY;
const xummSdk = new XummSdk(XUMM_API_KEY, XUMM_SECRET_KEY);

// Initialize XRPL client
const client = new Client('wss://s.altnet.rippletest.net:51233'); // Using testnet
client.on('error', (error) => console.log(error));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Function to check if wallet has enough SeagullCoin (0.5 required for minting)
async function checkSeagullCoinPayment(walletAddress, amountRequired) {
  try {
    const response = await axios.post('https://api.xrpl.org/v2/accounts/lines', {
      account: walletAddress,
    });

    const lines = response.data.result.lines;

    // Find SeagullCoin trustline
    const seagullCoinLine = lines.find(line => line.currency === 'SGLCN' && line.account === process.env.SERVICE_WALLET);

    if (seagullCoinLine) {
      const balance = parseFloat(seagullCoinLine.balance);
      return balance >= parseFloat(amountRequired);
    }

    return false;
  } catch (error) {
    console.error('Error checking SeagullCoin payment:', error);
    return false;
  }
}

// Route to mint an NFT
app.post('/mint', async (req, res) => {
  const { walletAddress, metadata } = req.body;
  const amountRequired = 0.5; // SeagullCoin required for minting

  // Check if wallet has enough SeagullCoin
  const hasEnoughCoins = await checkSeagullCoinPayment(walletAddress, amountRequired);

  if (!hasEnoughCoins) {
    return res.status(400).json({ error: 'Insufficient SeagullCoin balance' });
  }

  // Create NFT Minting transaction
  try {
    const transaction = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      NFTokenTaxon: 0,
      URI: metadata.uri,  // Assuming metadata.uri contains a link to the metadata
    };

    const { data } = await xummSdk.payload.create(transaction);
    return res.status(200).json({ success: true, tx_hash: data.hash });
  } catch (error) {
    console.error('Error minting NFT:', error);
    return res.status(500).json({ error: 'Minting failed' });
  }
});

// Route to buy an NFT (Listing NFT for Sale)
app.post('/buy-nft', async (req, res) => {
  const { walletAddress, nftId, price } = req.body;

  try {
    const transaction = {
      TransactionType: 'NFTokenCreateOffer',
      Account: walletAddress,
      NFTokenID: nftId,
      Amount: price, // Price in SeagullCoin (SGLCN)
      Flags: 131072, // Offer flags
    };

    const { data } = await xummSdk.payload.create(transaction);
    return res.status(200).json({ success: true, tx_hash: data.hash });
  } catch (error) {
    console.error('Error listing NFT for sale:', error);
    return res.status(500).json({ error: 'Listing failed' });
  }
});

// Route to cancel an XRP offer (ensure it's only SeagullCoin)
app.post('/cancel-xrp-offer', async (req, res) => {
  const { walletAddress, nftId } = req.body;

  try {
    const transaction = {
      TransactionType: 'NFTokenCancelOffer',
      Account: walletAddress,
      NFTokenID: nftId,
    };

    const { data } = await xummSdk.payload.create(transaction);
    return res.status(200).json({ success: true, tx_hash: data.hash });
  } catch (error) {
    console.error('Error canceling XRP offer:', error);
    return res.status(500).json({ error: 'Cancel failed' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
