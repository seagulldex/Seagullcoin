import express from 'express';
import { Client } from 'xrpl';
import { XummSdk } from 'xumm-sdk';  // Corrected import
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc'; // Import swagger-jsdoc
import swaggerUi from 'swagger-ui-express'; // Import swagger-ui-express
import { NFTStorage, File } from 'nft.storage'; // Corrected import for named exports

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize XummSdk correctly as per version 2.0 and above
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_SECRET_KEY);

// XRPL Client setup
const client = new Client(process.env.XRPL_NODE_URL);

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
    const accountInfo = await client.request({
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

    const mintResult = await client.submitAndWait(mintTransaction);
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

/**
 * @swagger
 * /api/nft/{id}/history:
 *   get:
 *     summary: Get transaction history for a specific NFT
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the NFT
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction history of the NFT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: NFT not found
 */
app.get('/api/nft/:id/history', async (req, res) => {
    const nftId = req.params.id;
    // Logic to retrieve transaction history
    res.json(history);
});

/**
 * @swagger
 * /api/sell-nft:
 *   post:
 *     summary: Create a sale listing for an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the user selling the NFT
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT to sell
 *               price:
 *                 type: number
 *                 format: float
 *                 description: The price in SeagullCoin
 *     responses:
 *       200:
 *         description: Success, NFT listed for sale
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saleResult:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 */
app.post('/api/sell-nft', async (req, res) => {
    const { wallet, nftId, price } = req.body;
    // Logic to create a sell offer for the NFT
    res.json(sellResult);
});

/**
 * @swagger
 * /api/cancel-sale:
 *   post:
 *     summary: Cancel a sale offer for an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the seller
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT to cancel sale for
 *     responses:
 *       200:
 *         description: Sale offer successfully canceled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cancelResult:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 */
app.post('/api/cancel-sale', async (req, res) => {
    const { wallet, nftId } = req.body;
    // Logic to cancel the sale offer for the NFT
    res.json(cancelResult);
});

/**
 * @swagger
 * /api/bid-nft:
 *   post:
 *     summary: Place a bid on an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the bidder
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT to bid on
 *               bidAmount:
 *                 type: number
 *                 format: float
 *                 description: The bid amount in SeagullCoin
 *     responses:
 *       200:
 *         description: Success, bid placed on the NFT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bidResult:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 */
app.post('/api/bid-nft', async (req, res) => {
    const { wallet, nftId, bidAmount } = req.body;
    // Logic to handle NFT bidding
    res.json(bidResult);
});

/**
 * @swagger
 * /api/accept-bid:
 *   post:
 *     summary: Accept a bid on an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the seller accepting the bid
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT to accept a bid for
 *               bidAmount:
 *                 type: number
 *                 format: float
 *                 description: The amount of the accepted bid in SeagullCoin
 *     responses:
 *       200:
 *         description: Success, bid accepted and NFT transferred
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 acceptBidResult:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 */
app.post('/api/accept-bid', async (req, res) => {
    const { wallet, nftId, bidAmount } = req.body;
    // Logic to accept the bid and transfer NFT ownership
    res.json(acceptBidResult);
});

/**
 * @swagger
 * /api/user/{wallet}/nfts:
 *   get:
 *     summary: Get all NFTs owned by a wallet
 *     parameters:
 *       - name: wallet
 *         in: path
 *         required: true
 *         description: The wallet address of the user
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of NFTs owned by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: Wallet not found
 */
app.get('/api/user/:wallet/nfts', async (req, res) => {
    const wallet = req.params.wallet;
    // Logic to retrieve NFTs owned by the wallet
    res.json(userNFTs);
});

/**
 * @swagger
 * /api/approve-nft-sale:
 *   post:
 *     summary: Approve or reject an NFT sale offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the seller
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT for sale
 *               approve:
 *                 type: boolean
 *                 description: Whether to approve or reject the sale offer
 *     responses:
 *       200:
 *         description: Sale offer approved or rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 approvalResult:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 */
app.post('/api/approve-nft-sale', async (req, res) => {
    const { wallet, nftId, approve } = req.body;
    // Logic to approve or reject a sale offer
    res.json(approvalResult);
});

/**
 * @swagger
 * /api/marketplace:
 *   get:
 *     summary: Get all NFTs for sale in the marketplace
 *     responses:
 *       200:
 *         description: List of all NFTs for sale
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get('/api/marketplace', async (req, res) => {
    // Logic to retrieve all NFTs for sale in the marketplace
    res.json(availableNFTs);
});

/**
 * @swagger
 * /api/nft/{id}/owner:
 *   get:
 *     summary: Get the current owner of an NFT
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the NFT
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The current owner of the NFT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 owner:
 *                   type: string
 *                   description: Wallet address of the current owner
 *       404:
 *         description: NFT not found
 */
app.get('/api/nft/:id/owner', async (req, res) => {
    const nftId = req.params.id;
    // Logic to get the current owner of the NFT
    res.json(owner);
});

/**
 * @swagger
 * /api/transfer-ownership:
 *   post:
 *     summary: Transfer ownership of an NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the current owner
 *               nftId:
 *                 type: string
 *                 description: The ID of the NFT
 *               recipient:
 *                 type: string
 *                 description: The wallet address of the recipient
 *     responses:
 *       200:
 *         description: Ownership successfully transferred
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transferResult:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 */
app.post('/api/transfer-ownership', async (req, res) => {
    const { wallet, nftId, recipient } = req.body;
    // Logic to transfer ownership of an NFT
    res.json(transferResult);
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

    const paymentResult = await client.submitAndWait(payment);
    return paymentResult;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
