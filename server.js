import express from 'express';
import dotenv from 'dotenv';
import { XummSdk } from 'xumm-sdk';
import bodyParser from 'body-parser';
import cors from 'cors';
import multer from 'multer';
import { NFTStorage, File } from 'nft.storage';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';

dotenv.config();

// Initialize Express
const app = express();

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later."
}));

app.use(cors());
app.use(bodyParser.json());

// File upload setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// XUMM SDK setup
const xumm = new XummSdk({
  apiKey: process.env.XUMM_API_KEY,
  apiSecret: process.env.XUMM_API_SECRET
});

// NFT.Storage client setup
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

// SeagullCoin enforcement constants
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const SEAGULLCOIN_TOKEN = '53656167756C6C436F696E000000000000000000';

// Helper function to verify SeagullCoin payment
async function verifySeagullCoinPayment(paymentTransaction) {
  const xrplClient = new XRPL.Client('wss://s.altnet.rippletest.net:51233');  // Testnet URL, replace with mainnet URL
  const payment = await xrplClient.getTransaction(paymentTransaction);
  return payment?.TransactionType === 'Payment' && payment?.Amount?.currency === SEAGULLCOIN_TOKEN;
}

// Swagger API Docs setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SeagullCoin NFT Minting API',
      version: '1.0.0',
      description: 'API for minting and managing SeagullCoin-based NFTs on the XRPL.'
    },
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Endpoint to mint an NFT
app.post('/mint', upload.single('file'), async (req, res) => {
  const { name, description, collection, paymentTransaction } = req.body;
  const file = req.file;

  try {
    // Verify payment is in SeagullCoin
    if (!(await verifySeagullCoinPayment(paymentTransaction))) {
      return res.status(400).json({ error: 'Minting requires payment in SeagullCoin (SGLCN-X20).' });
    }

    // Upload file to NFT.Storage
    const fileURL = await nftStorage.store(new File([file.buffer], file.originalname));

    // Store metadata (in reality, you would save this data in a database)
    const nftData = { name, description, collection, image: fileURL.url };
    res.status(200).json({ success: true, nftData });
  } catch (error) {
    console.error('Minting error:', error);
    res.status(500).json({ error: 'Failed to mint NFT.' });
  }
});

// Endpoint to buy an NFT
app.post('/buy-nft', async (req, res) => {
  const { nftId, paymentTransaction } = req.body;

  try {
    if (!(await verifySeagullCoinPayment(paymentTransaction))) {
      return res.status(400).json({ error: 'Payment must be in SeagullCoin (SGLCN-X20).' });
    }

    // Handle the purchase logic (e.g., transferring NFT)
    res.status(200).json({ success: true, message: 'NFT bought successfully.' });
  } catch (error) {
    console.error('Buying NFT error:', error);
    res.status(500).json({ error: 'Failed to buy NFT.' });
  }
});

// Endpoint to sell an NFT
app.post('/sell-nft', async (req, res) => {
  const { nftId, price, sellerAddress } = req.body;

  // Ensure price is in SeagullCoin (SGLCN-X20)
  if (price.currency !== SEAGULLCOIN_TOKEN) {
    return res.status(400).json({ error: 'NFT sale must be in SeagullCoin (SGLCN-X20).' });
  }

  // Handle the listing logic (e.g., storing for sale)
  res.status(200).json({ success: true, message: 'NFT listed for sale.' });
});

// Swagger documentation for minting
/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint a new SeagullCoin-based NFT.
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: The media file to upload for the NFT.
 *       - in: formData
 *         name: name
 *         type: string
 *         required: true
 *         description: The name of the NFT.
 *       - in: formData
 *         name: description
 *         type: string
 *         required: true
 *         description: The description of the NFT.
 *       - in: formData
 *         name: collection
 *         type: string
 *         required: false
 *         description: The collection to which the NFT belongs.
 *     responses:
 *       200:
 *         description: Successfully minted NFT.
 *       400:
 *         description: Invalid payment, must be in SeagullCoin.
 *       500:
 *         description: Internal server error.
 */

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running on port 3000');
});
