// server.js - Full SeagullCoin-Only NFT Marketplace Backend for XRPL

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

// Helpers
const xrpl = require('xrpl');
const { mintNFT, burnNFT, transferNFT } = require('./mintingLogic');
const { createOffer, cancelOffer, acceptOffer } = require('./offerLogic');
const { verifyXummPayload, createXummPayload } = require('./xummLogic');

// Models
const NFT = require('./models/NFT');
const Offer = require('./models/Offer');
const User = require('./models/User');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Swagger Setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'SGLCN-X20 NFT Marketplace API',
      version: '1.0.0',
      description: 'API for SeagullCoin-only NFT marketplace on XRPL',
    },
  },
  apis: ['./server.js'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// SeagullCoin Constants
const SEAGULLCOIN_CODE = "SeagullCoin";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";

// Utils
const enforceSeagullCoinOnly = (currency, issuer) =>
  currency === SEAGULLCOIN_CODE && issuer === SEAGULLCOIN_ISSUER;

// Routes

// XUMM Auth
app.post('/auth', verifyXummPayload);

// NFT Minting
app.post('/mint', mintNFT);
app.delete('/nft/:id', burnNFT);
app.get('/nfts', async (req, res) => {
  const nfts = await NFT.find().sort({ createdAt: -1 });
  res.json(nfts);
});
app.get('/nfts/:id', async (req, res) => {
  const nft = await NFT.findById(req.params.id);
  if (!nft) return res.status(404).send('NFT not found');
  res.json(nft);
});

// NFT Transfer
app.post('/nft/:id/transfer', transferNFT);

// Offer Management
app.post('/offers', createOffer);
app.get('/offers', async (req, res) => {
  const offers = await Offer.find();
  res.json(offers);
});
app.get('/offers/:id', async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).send('Offer not found');
  res.json(offer);
});
app.post('/offers/:id/accept', acceptOffer);
app.delete('/offers/:id', cancelOffer);

// Users
app.post('/users', async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.status(201).json(user);
});
app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).send('User not found');
  res.json(user);
});
app.put('/users/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(user);
});

// Transactions
app.get('/transactions', async (req, res) => {
  const txns = await Transaction.find();
  res.json(txns);
});
app.get('/transactions/:id', async (req, res) => {
  const txn = await Transaction.findById(req.params.id);
  if (!txn) return res.status(404).send('Transaction not found');
  res.json(txn);
});

// DB & Server Init
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => console.error('MongoDB connection error:', err));
