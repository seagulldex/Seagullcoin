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

// Helper function to check SeagullCoin balance
async function checkSeagullCoinBalance(wallet) {
    const accountInfo = await client.request({
        command: 'account_info',
        account: wallet,
    });
    const balance = accountInfo.result.account_data.Balance;
    return balance;
}

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the SeagullCoin NFT Minting API! Access the documentation at /docs');
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
