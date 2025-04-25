import express from 'express';
import { Client } from 'xrpl';
import { XummSdk } from 'xumm-sdk';  // Corrected import
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc'; // Import swagger-jsdoc
import swaggerUi from 'swagger-ui-express'; // Import swagger-ui-express
import axios from 'axios';  // Added axios for making HTTP requests to IPFS

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize XummSdk correctly as per version 2.0 and above
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_SECRET_KEY);

// XRPL Client setup
const client = new Client(process.env.XRPL_NODE_URL);

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
                url: `http://localhost:${port}`, // Adjust the URL if needed for production
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

// Helper function to fetch NFT details from NFT.Storage using the NFT ID (IPFS hash)
async function getNFTDetails(nftId) {
    try {
        // Construct the URL to fetch metadata from NFT.Storage via the IPFS hash (NFT ID)
        const ipfsUrl = `https://ipfs.infura.io/ipfs/${nftId}`;

        // Make a GET request to the IPFS URL to fetch metadata
        const response = await axios.get(ipfsUrl);

        // Return the metadata if found
        if (response.data) {
            return {
                id: nftId,
                name: response.data.name,
                description: response.data.description,
                file: response.data.image, // Assuming 'image' is the property storing the file URL
                collection: response.data.collection || 'Unknown Collection', // Assuming a collection field
            };
        }

        // If no data is found, return null
        return null;
    } catch (error) {
        throw new Error('Error fetching NFT details from IPFS: ' + error.message);
    }
}

/**
 * @swagger
 * /api/nft/{id}:
 *   get:
 *     description: Get details of a specific NFT by its ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: The ID (IPFS hash) of the NFT to fetch
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: NFT details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The unique ID of the NFT
 *                 name:
 *                   type: string
 *                   description: Name of the NFT
 *                 description:
 *                   type: string
 *                   description: Description of the NFT
 *                 file:
 *                   type: string
 *                   description: URI or file URL associated with the NFT
 *                 collection:
 *                   type: string
 *                   description: The collection the NFT belongs to
 *       400:
 *         description: Invalid NFT ID
 *       500:
 *         description: Server error
 */
app.get('/api/nft/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'NFT ID is required' });
    }

    try {
        // Fetch the NFT details using the ID (IPFS hash)
        const nftDetails = await getNFTDetails(id);

        if (!nftDetails) {
            return res.status(404).json({ error: 'NFT not found' });
        }

        res.status(200).json(nftDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mint:
 *   post:
 *     description: Mint an NFT using SeagullCoin
 *     parameters:
 *       - name: wallet
 *         in: body
 *         description: Wallet address of the user
 *         required: true
 *         schema:
 *           type: string
 *       - name: nftMetadata
 *         in: body
 *         description: Metadata for the NFT
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             description:
 *               type: string
 *             file:
 *               type: string
 *             collection:
 *               type: string
 *     responses:
 *       200:
 *         description: NFT minted successfully
 *       400:
 *         description: Invalid input or insufficient balance
 *       500:
 *         description: Server error
 */
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

// Helper function to check SeagullCoin balance
async function checkSeagullCoinBalance(wallet) {
    const accountInfo = await client.request({
        command: 'account_info',
        account: wallet,
    });
    const balance = accountInfo.result.account_data.Balance;
    return balance;
}

// Helper function to mint NFT (SeagullCoin-only)
async function mintNFT(wallet, nftMetadata) {
    const { name, description, file, collection } = nftMetadata;

    const mintTransaction = {
        TransactionType: 'NFTokenMint',
        Account: wallet,
        TokenTaxon: 0,
        URI: file, // Typically, this would be a URL to the file on IPFS
        Flags: 8, // Set this for non-fungible tokens
    };

    const mintResult = await client.submitAndWait(mintTransaction);
    return mintResult;
}

/**
 * @swagger
 * /api/buy-nft:
 *   post:
 *     description: Buy an NFT using SeagullCoin
 *     parameters:
 *       - name: wallet
 *         in: body
 *         description: Wallet address of the user
 *         required: true
 *         schema:
 *           type: string
 *       - name: nftId
 *         in: body
 *         description: NFT ID to be purchased
 *         required: true
 *         schema:
 *           type: string
 *       - name: price
 *         in: body
 *         description: Price of the NFT in SeagullCoin
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: NFT bought successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
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

    const paymentResult = await client.submitAndWait(payment);
    return paymentResult;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
