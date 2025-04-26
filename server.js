import express from 'express';
import { Client as XRPLClient } from 'xrpl';
import { XummSdk } from 'xumm-sdk';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { NFTStorage, File } from 'nft.storage';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize XRPL and XUMM clients
const xrplClient = new XRPLClient(process.env.XRPL_NODE_URL);
const walletclient = xrplClient;  // Assign xrplClient to client

// SeagullCoin X20 token details
const SEAGULLCOIN_HEX = '53656167756C6C436F696E000000000000000000';
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';

const walletClient = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

// NFT Storage Client setup
const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

// Middleware for JSON parsing and CORS
app.use(bodyParser.json());
app.use(cors());

// Swagger setup
const swaggerOptions = {
    swaggerDefinition: {
        info: {
            title: 'SeagullCoin NFT Minting API',
            version: '1.0.0',
            description: 'API for SeagullCoin-only minting, buying, and selling NFTs',
        },
        servers: [
            {
                url: process.env.API_BASE_URL || `http://localhost:${port}`,
 // Adjust the URL if needed for production
            },
        ],
    },
    apis: ['./server.js'], // Path to the API doc
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Serve Swagger docs at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Info route to check if API is running
app.get('/api/info', (req, res) => {
    res.send('SeagullCoin NFT Minting API is up and running!');
});

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the SeagullCoin NFT Minting API! Access the documentation at /docs');
});

/**
 * @swagger
 * /api/info:
 *   get:
 *     summary: Get API status
 *     description: Returns a message confirming that the SeagullCoin NFT Minting API is running.
 *     responses:
 *       200:
 *         description: API is running
 */

/**
 * @swagger
 * /api/mint:
 *   post:
 *     summary: Mint a new SeagullCoin NFT
 *     description: Mints a new NFT on the SeagullCoin network with the provided metadata.
 *     parameters:
 *       - in: body
 *         name: nftMetadata
 *         description: Metadata of the NFT to be minted
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - wallet
 *             - nftMetadata
 *           properties:
 *             wallet:
 *               type: string
 *               description: The wallet address of the user minting the NFT
 *             nftMetadata:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   description: Name of the NFT
 *                 description:
 *                   type: string
 *                   description: Description of the NFT
 *                 file:
 *                   type: string
 *                   description: File for the NFT image
 *                 collection:
 *                   type: string
 *                   description: Collection to which the NFT belongs
 *     responses:
 *       200:
 *         description: NFT minted successfully
 *       400:
 *         description: Missing required parameters or insufficient balance
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/buy-nft:
 *   post:
 *     summary: Buy an NFT with SeagullCoin
 *     description: Allows a user to buy an NFT with SeagullCoin. The payment will be sent to the seller's wallet.
 *     parameters:
 *       - in: body
 *         name: buyDetails
 *         description: Details of the NFT purchase
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - wallet
 *             - nftId
 *             - price
 *           properties:
 *             wallet:
 *               type: string
 *               description: The wallet address of the user buying the NFT
 *             nftId:
 *               type: string
 *               description: The ID of the NFT being purchased
 *             price:
 *               type: string
 *               description: Price of the NFT in SeagullCoin
 *     responses:
 *       200:
 *         description: NFT bought successfully
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/mint:
 *   post:
 *     summary: Mint an NFT
 *     description: Mints a new NFT on the SeagullCoin network after verifying wallet balance.
 *     parameters:
 *       - name: wallet
 *         in: body
 *         required: true
 *         description: The wallet address of the user minting the NFT
 *       - name: nftMetadata
 *         in: body
 *         required: true
 *         description: Metadata of the NFT to be minted (e.g., name, description, image, collection)
 *     responses:
 *       200:
 *         description: NFT minted successfully
 *       400:
 *         description: Missing required parameters or insufficient balance
 *       500:
 *         description: Internal server error
 */

// Helper function to check SeagullCoin balance
async function checkSeagullCoinBalance(wallet) {
    const accountInfo = await walletclient.request({
        command: 'account_info',
        account: wallet,
    });
    const balance = accountInfo.result.account_data.Balance;
    return balance;
}

// Swagger: Get SeagullCoin balance for a given wallet
/**
 * @swagger
 * /api/balance/{wallet}:
 *   get:
 *     summary: "Retrieve the SeagullCoin balance for a given wallet address"
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         description: The wallet address to check the balance.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Wallet balance retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallet:
 *                   type: string
 *                 balance:
 *                   type: string
 *       500:
 *         description: "Error retrieving balance"
 */
app.get('/api/balance/:wallet', async (req, res) => {
    const { wallet } = req.params;
    try {
        const balance = await checkSeagullCoinBalance(wallet);
        res.status(200).json({ wallet, balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Swagger: Get NFT metadata by ID
/**
 * @swagger
 * /api/nft/{id}:
 *   get:
 *     summary: "Retrieve the metadata for a specific NFT by ID"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the NFT to retrieve.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "NFT metadata retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nftId:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       500:
 *         description: "Error retrieving NFT metadata"
 */
app.get('/api/nft/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const nft = await nftStorageClient.get(id);
        res.status(200).json(nft);
    } catch (error) {
        res.status(500).json({ error: 'NFT not found' });
    }
});

// Swagger: List all NFTs
/**
 * @swagger
 * /api/nfts:
 *   get:
 *     summary: "List all NFTs on the platform"
 *     responses:
 *       200:
 *         description: "List of all NFTs"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: "Error retrieving NFTs"
 */
app.get('/api/nfts', async (req, res) => {
    try {
        const nfts = await nftStorageClient.list();
        res.status(200).json(nfts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Swagger: Create a new NFT collection
/**
 * @swagger
 * /api/collections:
 *   post:
 *     summary: "Create a new NFT collection"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               logo:
 *                 type: string
 *     responses:
 *       201:
 *         description: "Collection created successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 logo:
 *                   type: string
 *       400:
 *         description: "Missing required parameters"
 *       500:
 *         description: "Error creating collection"
 */
app.post('/api/collections', async (req, res) => {
    const { name, description, logo } = req.body;
    if (!name || !description || !logo) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const collection = {
            name,
            description,
            logo,
        };
        // Save collection logic here
        res.status(201).json(collection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Swagger: List all NFT collections
/**
 * @swagger
 * /api/collections:
 *   get:
 *     summary: "List all NFT collections on the platform"
 *     responses:
 *       200:
 *         description: "List of all NFT collections"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: "Error retrieving collections"
 */
app.get('/api/collections', async (req, res) => {
    try {
        // Replace with your logic to fetch collections from storage
        const collections = []; // Placeholder for collection data
        res.status(200).json(collections);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Swagger: Transfer NFT to another wallet
/**
 * @swagger
 * /api/transfer-nft:
 *   post:
 *     summary: "Transfer an NFT to another wallet"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *               nftId:
 *                 type: string
 *               recipient:
 *                 type: string
 *     responses:
 *       200:
 *         description: "NFT transferred successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 nftId:
 *                   type: string
 *                 recipient:
 *                   type: string
 *       400:
 *         description: "Missing required parameters"
 *       500:
 *         description: "Error transferring NFT"
 */
app.post('/api/transfer-nft', async (req, res) => {
    const { wallet, nftId, recipient } = req.body;
    if (!wallet || !nftId || !recipient) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Transfer NFT logic here
        const transferResult = { success: true, nftId, recipient };
        res.status(200).json(transferResult);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to mint NFT (SeagullCoin-only)
async function mintNFT(wallet, nftMetadata) {
    const { name, description, file, collection } = nftMetadata;

    // Upload the file to NFT.Storage
    const metadata = await nftStorageClient.store({
        name: name,
        description: description,
        image: file,
        collection: collection
    });

    const mintTransaction = {
        TransactionType: 'NFTokenMint',
        Account: wallet,
        TokenTaxon: 0,
        URI: metadata.url, // The URL from NFT.Storage
        Flags: 8, // Set this for non-fungible tokens
    };

    const mintResult = await walletclient.submitAndWait(mintTransaction);
    return mintResult;
}

// Mint NFT route
app.post('/api/mint', async (req, res) => {
    const { wallet, nftMetadata } = req.body;

    if (!wallet || !nftMetadata) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const balance = await checkSeagullCoinBalance(wallet);

        if (balance < parseFloat(process.env.MINT_COST)) {
            return res.status(400).json({ error: 'Insufficient balance for minting' });
        }

        const mintResult = await mintNFT(wallet, nftMetadata);
        res.status(200).json(mintResult);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buying NFT route
app.post('/api/buy-nft', async (req, res) => {
    const { wallet, nftId, price } = req.body;

    if (!wallet || !nftId || !price) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const buyResult = await buyNFT(wallet, nftId, price);
        res.status(200).json(buyResult);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to handle buying NFTs
async function buyNFT(wallet, nftId, price) {
    const payment = {
        TransactionType: 'Payment',
        Account: wallet,
        Amount: price, // Amount in SeagullCoin
        Destination: process.env.SERVICE_WALLET, // The wallet of the NFT seller
    };

    const paymentResult = await walletclient.submitAndWait(payment);
    return paymentResult;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
