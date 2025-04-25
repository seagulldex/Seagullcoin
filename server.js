import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Assuming you have a function to check SeagullCoin payment
import { checkSeagullCoinPayment, mintNFT, transferNFT, listNFTForSale } from './xrp-utils';

const app = express();
app.use(express.json());

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SeagullCoin NFT Minting API',
      version: '1.0.0',
      description: 'API for minting SeagullCoin NFTs, buying, and selling',
    },
    servers: [
      {
        url: 'http://localhost:3000', // Change to your live URL in production
      },
    ],
  },
  apis: ['./server.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Sample /mint endpoint
/**
 * @swagger
 * /mint:
 *   post:
 *     summary: "Mint a SeagullCoin NFT"
 *     description: "Mint a SeagullCoin NFT after paying the minting fee in SeagullCoin."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: "XUMM wallet address"
 *                 example: "rEXAMPLE1234567890"
 *               metadata:
 *                 type: string
 *                 description: "Metadata for the NFT"
 *                 example: "http://link.to/metadata.json"
 *     responses:
 *       200:
 *         description: "NFT minted successfully"
 *       400:
 *         description: "Invalid or insufficient SeagullCoin payment"
 *       500:
 *         description: "Internal server error"
 */
app.post('/mint', async (req, res) => {
  const { wallet, metadata } = req.body;

  // Enforce SeagullCoin payment for minting
  const isPaymentValid = await checkSeagullCoinPayment(wallet, 0.5); // Ensure 0.5 SeagullCoin
  if (!isPaymentValid) {
    return res.status(400).json({ error: 'Invalid or insufficient SeagullCoin payment' });
  }

  // Mint the NFT
  const nftId = await mintNFT(wallet, metadata);
  res.status(200).json({ success: true, nftId });
});

// Sample /buy endpoint
/**
 * @swagger
 * /buy:
 *   post:
 *     summary: "Buy a SeagullCoin NFT"
 *     description: "Buy an NFT listed for sale with SeagullCoin."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: "XUMM wallet address"
 *                 example: "rEXAMPLE1234567890"
 *               nftId:
 *                 type: string
 *                 description: "NFT ID to buy"
 *                 example: "12345"
 *               price:
 *                 type: string
 *                 description: "Price in SeagullCoin"
 *                 example: "0.5"
 *     responses:
 *       200:
 *         description: "NFT bought successfully"
 *       400:
 *         description: "Invalid or insufficient SeagullCoin payment"
 *       500:
 *         description: "Internal server error"
 */
app.post('/buy', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  // Enforce SeagullCoin payment for buying (check if the payment is in SeagullCoin)
  const isPaymentValid = await checkSeagullCoinPayment(wallet, price);
  if (!isPaymentValid) {
    return res.status(400).json({ error: 'Invalid SeagullCoin payment' });
  }

  // Transfer the NFT to the buyer
  await transferNFT(wallet, nftId);

  res.status(200).json({ success: true, message: 'NFT bought successfully' });
});

// Sample /sell endpoint
/**
 * @swagger
 * /sell:
 *   post:
 *     summary: "Sell a SeagullCoin NFT"
 *     description: "Sell an NFT for a specified price in SeagullCoin."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: "XUMM wallet address"
 *                 example: "rEXAMPLE1234567890"
 *               nftId:
 *                 type: string
 *                 description: "NFT ID to sell"
 *                 example: "12345"
 *               price:
 *                 type: string
 *                 description: "Price in SeagullCoin"
 *                 example: "0.5"
 *     responses:
 *       200:
 *         description: "NFT listed for sale successfully"
 *       400:
 *         description: "Invalid request or insufficient SeagullCoin"
 *       500:
 *         description: "Internal server error"
 */
app.post('/sell', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  // Enforce SeagullCoin pricing for selling
  if (isNaN(price) || parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Price must be in SeagullCoin and greater than 0' });
  }

  // List the NFT for sale
  await listNFTForSale(wallet, nftId, price);

  res.status(200).json({ success: true, message: 'NFT listed for sale successfully' });
});

// Swagger setup
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
