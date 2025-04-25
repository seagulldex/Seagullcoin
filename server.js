const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const dotenv = require('dotenv');
const { XummSdk } = require('xumm-sdk'); // Correct import for version >= 2.0.0
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// XUMM SDK setup (ensure you have configured your XUMM API key)
const xumm = new XummSdk({
  apiKey: process.env.XUMM_API_KEY,
  apiSecret: process.env.XUMM_API_SECRET,
});

// Swagger API documentation configuration
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

/**
 * @openapi
 * /mint:
 *   post:
 *     summary: Mint a new NFT
 *     description: This endpoint allows users to mint a new NFT using SeagullCoin.
 *     operationId: mintNFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the user minting the NFT
 *               metadata:
 *                 type: string
 *                 description: The metadata URI of the NFT
 *             required:
 *               - wallet
 *               - metadata
 *     responses:
 *       '200':
 *         description: Minting successful
 *       '400':
 *         description: Invalid input or missing required parameters
 */
app.post('/mint', async (req, res) => {
  const { wallet, metadata } = req.body;

  // Ensure the required fields are present
  if (!wallet || !metadata) {
    return res.status(400).send({ message: 'Missing required fields' });
  }

  try {
    // Logic to check if the user has sufficient SeagullCoin for minting
    const payment = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Account: wallet,
        Destination: process.env.SERVICE_WALLET,
        Amount: '5000000', // 0.5 SeagullCoin (make sure this matches your actual minting fee)
        Currency: 'SGLCN-X20', // SeagullCoin (Token ID)
      },
    });

    // Here we simulate the actual minting process after confirming the payment
    if (payment) {
      // Implement NFT creation logic (e.g., creating a token, storing metadata, etc.)
      res.send({ message: 'Minting successful', payment });
    } else {
      res.status(400).send({ message: 'Payment failed' });
    }
  } catch (err) {
    res.status(500).send({ message: 'Error minting NFT', error: err.message });
  }
});

/**
 * @openapi
 * /buy:
 *   post:
 *     summary: Buy an NFT with SeagullCoin
 *     description: This endpoint allows users to buy an NFT using SeagullCoin.
 *     operationId: buyNFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT being purchased
 *               price:
 *                 type: number
 *                 description: The price of the NFT in SeagullCoin
 *             required:
 *               - nftId
 *               - price
 *     responses:
 *       '200':
 *         description: Purchase successful
 *       '400':
 *         description: Invalid input or missing required parameters
 */
app.post('/buy', async (req, res) => {
  const { nftId, price, wallet } = req.body;

  // Ensure the required fields are present
  if (!nftId || !price || !wallet) {
    return res.status(400).send({ message: 'Missing required fields' });
  }

  try {
    // Logic to process the SeagullCoin payment for purchasing the NFT
    const payment = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Account: wallet,
        Destination: process.env.SERVICE_WALLET,
        Amount: price.toString(), // Price in SeagullCoin
        Currency: 'SGLCN-X20', // SeagullCoin (Token ID)
      },
    });

    // Here we simulate the purchase after confirming the payment
    if (payment) {
      // Implement NFT transfer logic (e.g., transferring the NFT to the buyer)
      res.send({ message: 'Purchase successful', payment });
    } else {
      res.status(400).send({ message: 'Payment failed' });
    }
  } catch (err) {
    res.status(500).send({ message: 'Error processing purchase', error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
