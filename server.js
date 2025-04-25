import express from 'express';
import { Client } from 'xrpl';
import { XummSdk } from 'xumm-sdk'; // Corrected import
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc'; // Import swagger-jsdoc
import swaggerUi from 'swagger-ui-express'; // Import swagger-ui-express
import axios from 'axios'; // Added axios for API calls

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

// Root route to serve a simple status or home message
app.get('/', (req, res) => {
    res.send('Welcome to the SeagullCoin NFT Minting API. Access the API documentation at /docs');
});

/**
 * @swagger
 * /api/nft/{id}:
 *   get:
 *     description: Get details of a specific NFT by its ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: The ID (CID) of the NFT
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully fetched NFT details
 *       400:
 *         description: Invalid input
 *       404:
 *         description: NFT not found
 *       500:
 *         description: Server error
 */
app.get('/api/nft/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'NFT ID is required' });
    }

    try {
        // Fetch the NFT metadata from NFT.Storage using the ID (CID)
        const nftMetadata = await fetchNFTMetadata(id);

        if (!nftMetadata) {
            return res.status(404).json({ error: 'NFT not found' });
        }

        res.status(200).json(nftMetadata);
    } catch (error) {
        console.error('Error fetching NFT details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Function to fetch metadata from NFT.Storage
async function fetchNFTMetadata(id) {
    try {
        // Make the API request to NFT.Storage to fetch metadata
        const response = await axios.get(`https://api.nft.storage/${id}`, {
            headers: {
                'Authorization': `Bearer ${process.env.NFT_STORAGE_KEY}`
            }
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.error('NFT Storage Error:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error fetching NFT metadata:', error);
        return null;
    }
}

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
    try {
        // Request account info to get the balance of SeagullCoin
        const accountInfo = await client.request({
            command: 'account_info',
            account: wallet,
        });

        // Extract the balance and find SeagullCoin (SGLCN-X20) in trust lines
        const trustlines = accountInfo.result.account_data.Tokens || [];
        const seagullCoinBalance = trustlines.find(
            (token) => token.Currency === 'SGLCN-X20'
        );

        // Return the SeagullCoin balance, or 0 if not found
        return seagullCoinBalance ? parseFloat(seagullCoinBalance.Balance) : 0;
    } catch (error) {
        console.error('Error checking SeagullCoin balance:', error);
        throw new Error('Unable to fetch SeagullCoin balance');
    }
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
