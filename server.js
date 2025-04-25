const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { checkSeagullCoinPayment, mintNFT, transferNFT, listNFTForSale, cancelXrpOffer } = require('./xrp-utils.js');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware setup
app.use(bodyParser.json());
app.use(cors());

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Payment and minting routes

// Route to check SeagullCoin balance and mint NFT
app.post('/mint', async (req, res) => {
  const { wallet, metadata } = req.body;

  // Ensure SeagullCoin payment is verified
  const isPaymentValid = await checkSeagullCoinPayment(wallet, 0.5);
  if (!isPaymentValid) {
    return res.status(400).json({ error: 'Insufficient SeagullCoin balance.' });
  }

  try {
    const transactionHash = await mintNFT(wallet, metadata);
    res.json({ success: true, transactionHash });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mint NFT.' });
  }
});

// Route to transfer NFT
app.post('/transfer', async (req, res) => {
  const { wallet, nftId, destinationWallet } = req.body;

  try {
    const transactionHash = await transferNFT(wallet, nftId, destinationWallet);
    res.json({ success: true, transactionHash });
  } catch (error) {
    res.status(500).json({ error: 'Failed to transfer NFT.' });
  }
});

// Route to list NFT for sale
app.post('/list-for-sale', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  try {
    const transactionHash = await listNFTForSale(wallet, nftId, price);
    res.json({ success: true, transactionHash });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list NFT for sale.' });
  }
});

// Route to cancel XRP offers for the NFT
app.post('/cancel-xrp-offer', async (req, res) => {
  const { wallet, nftId } = req.body;

  try {
    const transactionHash = await cancelXrpOffer(wallet, nftId);
    res.json({ success: true, transactionHash });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel XRP offer.' });
  }
});

// Default route for testing
app.get('/', (req, res) => {
  res.send('SeagullCoin NFT Minting Platform API is up and running!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
