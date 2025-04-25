import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { XummSdk } from 'xumm-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import pkg from 'xrpl'; // Import the whole package
const { Client, NFTokenMint, Payment, TrustSet } = pkg; // Destructure the necessary components from the package

// Load environment variables
dotenv.config();

const app = express();
const port = 3000;

// Set up Swagger options
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SeagullCoin Minting API',
      version: '1.0.0',
      description: 'API to mint, buy, and sell NFTs using SeagullCoin on XRPL',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
  },
  apis: ['./server.js'], // Path to the API docs (this file)
};

// Initialize SwaggerJSDoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger docs at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Create XUMM SDK instance
const xumm = new XummSdk({
  apiKey: process.env.XUMM_API_KEY,
  apiSecret: process.env.XUMM_SECRET_KEY,
});

// SeagullCoin details
const SEAGULLCOIN_CODE = process.env.SEAGULLCOIN_CODE;
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;

// Example API route to get information about the API
/**
 * @swagger
 * /api/info:
 *   get:
 *     summary: "Get API Info"
 *     description: "Returns basic information about the SeagullCoin Minting API"
 *     responses:
 *       200:
 *         description: "API info returned successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "SeagullCoin NFT Minting API is up and running!"
 */
app.get('/api/info', (req, res) => {
  res.json({ message: 'SeagullCoin NFT Minting API is up and running!' });
});

// Minting endpoint
/**
 * @swagger
 * /api/mint:
 *   post:
 *     summary: "Mint an NFT"
 *     description: "Mint a new NFT using SeagullCoin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: "Wallet address to mint the NFT"
 *               metadata:
 *                 type: object
 *                 description: "Metadata for the NFT"
 *                 example: { "name": "My NFT", "description": "An awesome NFT" }
 *     responses:
 *       200:
 *         description: "NFT minted successfully"
 *       400:
 *         description: "Invalid request"
 */
app.post('/api/mint', async (req, res) => {
  try {
    const { wallet, metadata } = req.body;

    // Check if the wallet has enough SeagullCoin (SGLCN-X20) for minting
    const client = new Client(process.env.XRPL_NODE_URL);
    await client.connect();

    // Get account info
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet,
    });

    const balance = accountInfo.result.account_data.Balance;

    // Check if the wallet has enough SeagullCoin for minting (MINT_COST from ENV)
    if (balance < process.env.MINT_COST) {
      return res.status(400).json({ message: 'Insufficient SeagullCoin balance for minting' });
    }

    // Mint the NFT using SeagullCoin (SGLCN-X20)
    const mintTransaction = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      Fee: '10', // Example fee (XRP)
      Flags: 8, // Non-fungible token minting flag
      TokenTaxon: 0, // Optional: Adjust token taxon
      NFTokenData: metadata, // Metadata for the NFT
    };

    const tx = await client.submitAndWait(mintTransaction);

    // Ensure the transaction used SeagullCoin (SGLCN-X20)
    const transactionDetails = await client.request({
      command: 'tx',
      transaction: tx.result.tx_json.hash,
    });

    const transactionCurrency = transactionDetails.result.meta.AffectedNodes[0].ModifiedNode.FinalFields.Currency;
    
    if (transactionCurrency !== SEAGULLCOIN_CODE) {
      return res.status(400).json({ message: 'Only SeagullCoin (SGLCN-X20) is allowed for minting' });
    }

    // Return success response
    res.status(200).json({ message: 'NFT minted successfully', txHash: tx.result.tx_json.hash });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to mint NFT', error: error.message });
  }
});

// Buying and selling will follow similar logic, ensuring SeagullCoin is used in the transaction

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
