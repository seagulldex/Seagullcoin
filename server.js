import express from 'express';
import bodyParser from 'body-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { checkSeagullCoinPayment, mintNFT, transferNFT, listNFTForSale } from './xrp-utils.js';  // Import the utility functions

const app = express();
const port = process.env.PORT || 3000;

// Body parser middleware
app.use(bodyParser.json());

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'SGLCN-X20 NFT Minting API',
      version: '1.0.0',
      description: 'API for minting and managing SeagullCoin-only NFTs',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./server.js'], // Specify the location of the Swagger docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Swagger docs for /mint endpoint
/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint a new NFT using SeagullCoin
 *     description: Mint a new NFT by paying with SeagullCoin (0.5 SGLCN-X20).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: User's wallet address
 *               metadata:
 *                 type: object
 *                 description: Metadata for the NFT
 *     responses:
 *       200:
 *         description: Successfully minted NFT
 *       400:
 *         description: Insufficient balance or error in minting
 */
app.post('/mint', async (req, res) => {
  const { wallet, metadata } = req.body;

  try {
    // Check if the wallet has enough SeagullCoin balance
    const hasEnoughBalance = await checkSeagullCoinPayment(wallet, 0.5);  // 0.5 SeagullCoin for minting

    if (!hasEnoughBalance) {
      return res.status(400).json({ error: 'Not enough SeagullCoin to mint NFT' });
    }

    // Mint the NFT
    const nftId = await mintNFT(wallet, metadata);

    if (nftId) {
      return res.status(200).json({ message: 'NFT minted successfully', nftId });
    } else {
      return res.status(500).json({ error: 'Error minting NFT' });
    }
  } catch (error) {
    console.error('Minting error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Swagger docs for /buy-nft endpoint
/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: Buy an NFT using SeagullCoin
 *     description: Buy an NFT by making an offer with SeagullCoin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: User's wallet address
 *               nftId:
 *                 type: string
 *                 description: ID of the NFT to purchase
 *               price:
 *                 type: number
 *                 description: The price for the NFT in SeagullCoin
 *     responses:
 *       200:
 *         description: Successfully bought NFT
 *       400:
 *         description: Error in buying NFT
 */
app.post('/buy-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  try {
    // Check if the wallet has enough SeagullCoin balance to buy the NFT
    const hasEnoughBalance = await checkSeagullCoinPayment(wallet, price);

    if (!hasEnoughBalance) {
      return res.status(400).json({ error: 'Not enough SeagullCoin to buy NFT' });
    }

    // Transfer the NFT to the buyer
    const transferResult = await transferNFT(wallet, nftId);

    if (transferResult) {
      return res.status(200).json({ message: 'NFT bought successfully', transferId: transferResult });
    } else {
      return res.status(500).json({ error: 'Error in transferring NFT' });
    }
  } catch (error) {
    console.error('Buying error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Swagger docs for /sell-nft endpoint
/**
 * @swagger
 * /sell-nft:
 *   post:
 *     summary: List an NFT for sale using SeagullCoin
 *     description: List an NFT for sale by setting a price in SeagullCoin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: User's wallet address
 *               nftId:
 *                 type: string
 *                 description: ID of the NFT to list for sale
 *               price:
 *                 type: number
 *                 description: The price for the NFT in SeagullCoin
 *     responses:
 *       200:
 *         description: Successfully listed NFT for sale
 *       400:
 *         description: Error in listing NFT for sale
 */
app.post('/sell-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  try {
    // List the NFT for sale
    const listResult = await listNFTForSale(wallet, nftId, price);

    if (listResult) {
      return res.status(200).json({ message: 'NFT listed for sale successfully', listId: listResult });
    } else {
      return res.status(500).json({ error: 'Error listing NFT for sale' });
    }
  } catch (error) {
    console.error('Selling error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

