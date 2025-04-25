import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';
import { checkSeagullCoinPayment, mintNFT, transferNFT, listNFTForSale, cancelXrpOffer } from './xrp-utils.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SeagullCoin Minting API',
      version: '1.0.0',
      description: 'API for minting and trading SeagullCoin-only NFTs on the XRPL',
    },
  },
  apis: ['./server.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint a SeagullCoin-only NFT
 *     description: Mint a new NFT using SeagullCoin only.
 *     parameters:
 *       - in: body
 *         name: metadata
 *         description: Metadata for the NFT
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: Name of the NFT
 *             description:
 *               type: string
 *               description: Description of the NFT
 *             image:
 *               type: string
 *               description: URL of the image for the NFT
 *     responses:
 *       200:
 *         description: Successfully minted NFT
 *       400:
 *         description: Invalid input
 */
app.post('/mint', async (req, res) => {
  const { wallet, metadata } = req.body;

  if (!wallet || !metadata) {
    return res.status(400).send('Missing wallet or metadata');
  }

  // Check SeagullCoin balance
  const hasSglcn = await checkSeagullCoinPayment(wallet, 0.5);
  if (!hasSglcn) {
    return res.status(400).send('Insufficient SeagullCoin balance');
  }

  // Mint the NFT
  const nftId = await mintNFT(wallet, metadata);
  if (nftId) {
    return res.status(200).send({ nftId });
  } else {
    return res.status(500).send('Failed to mint NFT');
  }
});

/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: Buy a SeagullCoin-only NFT
 *     description: Buy an NFT listed for sale using SeagullCoin only.
 *     parameters:
 *       - in: body
 *         name: nft
 *         description: NFT details to purchase
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             nftId:
 *               type: string
 *               description: The ID of the NFT
 *             price:
 *               type: number
 *               description: Price of the NFT in SeagullCoin
 *             buyerWallet:
 *               type: string
 *               description: Wallet address of the buyer
 *     responses:
 *       200:
 *         description: Successfully purchased NFT
 *       400:
 *         description: Invalid input or insufficient balance
 */
app.post('/buy-nft', async (req, res) => {
  const { nftId, price, buyerWallet } = req.body;

  if (!nftId || !price || !buyerWallet) {
    return res.status(400).send('Missing nftId, price, or buyerWallet');
  }

  const hasSglcn = await checkSeagullCoinPayment(buyerWallet, price);
  if (!hasSglcn) {
    return res.status(400).send('Insufficient SeagullCoin balance');
  }

  // Transfer the NFT
  const transactionId = await transferNFT(buyerWallet, nftId);
  if (transactionId) {
    return res.status(200).send({ transactionId });
  } else {
    return res.status(500).send('Failed to transfer NFT');
  }
});

/**
 * @swagger
 * /sell-nft:
 *   post:
 *     summary: List a SeagullCoin-only NFT for sale
 *     description: List an NFT for sale using SeagullCoin only.
 *     parameters:
 *       - in: body
 *         name: nft
 *         description: NFT details to list for sale
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             nftId:
 *               type: string
 *               description: The ID of the NFT
 *             price:
 *               type: number
 *               description: Price of the NFT in SeagullCoin
 *             sellerWallet:
 *               type: string
 *               description: Wallet address of the seller
 *     responses:
 *       200:
 *         description: Successfully listed NFT for sale
 *       400:
 *         description: Invalid input
 */
app.post('/sell-nft', async (req, res) => {
  const { nftId, price, sellerWallet } = req.body;

  if (!nftId || !price || !sellerWallet) {
    return res.status(400).send('Missing nftId, price, or sellerWallet');
  }

  // List the NFT for sale
  const transactionId = await listNFTForSale(sellerWallet, nftId, price);
  if (transactionId) {
    return res.status(200).send({ transactionId });
  } else {
    return res.status(500).send('Failed to list NFT');
  }
});

/**
 * @swagger
 * /cancel-xrp-offer:
 *   post:
 *     summary: Cancel any XRP offer for an NFT
 *     description: Cancel any XRP-related offer for an NFT.
 *     parameters:
 *       - in: body
 *         name: nft
 *         description: NFT offer to cancel
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             nftId:
 *               type: string
 *               description: The ID of the NFT
 *             wallet:
 *               type: string
 *               description: Wallet address of the user
 *     responses:
 *       200:
 *         description: Successfully canceled XRP offer
 *       400:
 *         description: Invalid input
 */
app.post('/cancel-xrp-offer', async (req, res) => {
  const { nftId, wallet } = req.body;

  if (!nftId || !wallet) {
    return res.status(400).send('Missing nftId or wallet');
  }

  const txnId = await cancelXrpOffer(wallet, nftId);
  if (txnId) {
    return res.status(200).send({ txnId });
  } else {
    return res.status(500).send('Failed to cancel XRP offer');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
