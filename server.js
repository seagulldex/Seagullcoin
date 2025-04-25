import express from 'express';
import { Client } from 'xrpl';
import { XummSdk } from 'xumm-sdk';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_SECRET_KEY);

const client = new Client(process.env.XRPL_NODE_URL);

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
                url: `http://localhost:${port}`,
            },
        ],
    },
    apis: ['./server.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/info', (req, res) => {
    res.send('SeagullCoin NFT Minting API is up and running!');
});

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

async function fetchNFTMetadata(id) {
    try {
        const response = await axios.get(`https://api.nft.storage/${id}`, {
            headers: {
                'Authorization': `Bearer ${process.env.NFT_STORAGE_KEY}`,
            },
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

/**
 * @swagger
 * /api/buy-nft:
 *   post:
 *     description: Buy an NFT using SeagullCoin
 *     parameters:
 *       - name: wallet
 *         in: body
 *         description: Wallet address of the buyer
 *         required: true
 *         schema:
 *           type: string
 *       - name: nftId
 *         in: body
 *         description: The ID of the NFT being bought
 *         required: true
 *         schema:
 *           type: string
 *       - name: price
 *         in: body
 *         description: The price of the NFT in SeagullCoin
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: NFT bought successfully
 *       400:
 *         description: Invalid input or insufficient balance
 *       500:
 *         description: Server error
 */
app.post('/api/buy-nft', async (req, res) => {
    const { wallet, nftId, price } = req.body;

    if (!wallet || !nftId || !price) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const balance = await checkSeagullCoinBalance(wallet);

        if (balance < price) {
            return res.status(400).json({ error: 'Insufficient balance for purchase' });
        }

        const paymentResult = await buyNFT(wallet, nftId, price);
        res.status(200).json(paymentResult);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     description: Get basic metrics like minted NFTs count
 *     responses:
 *       200:
 *         description: Successfully fetched metrics
 *       500:
 *         description: Server error
 */
app.get('/api/metrics', (req, res) => {
    const metrics = {
        mintedNFTs: 100, // Example value, this should be dynamically calculated
    };
    res.status(200).json(metrics);
});

async function checkSeagullCoinBalance(wallet) {
    try {
        const accountInfo = await client.request({
            command: 'account_info',
            account: wallet,
        });

        const trustlines = accountInfo.result.account_data.Tokens || [];
        const seagullCoinBalance = trustlines.find(
            (token) => token.Currency === 'SGLCN-X20'
        );

        return seagullCoinBalance ? parseFloat(seagullCoinBalance.Balance) : 0;
    } catch (error) {
        console.error('Error checking SeagullCoin balance:', error);
        throw new Error('Unable to fetch SeagullCoin balance');
    }
}

async function mintNFT(wallet, nftMetadata) {
    const { name, description, file, collection } = nftMetadata;

    const mintTransaction = {
        TransactionType: 'NFTokenMint',
        Account: wallet,
        TokenTaxon: 0,
        URI: file,
        Flags: 8,
    };

    const mintResult = await client.submitAndWait(mintTransaction);
    return mintResult;
}

async function buyNFT(wallet, nftId, price) {
    const payment = {
        TransactionType: 'Payment',
        Account: wallet,
        Amount: price,
        Destination: process.env.SERVICE_WALLET,
    };

    const paymentResult = await client.submitAndWait(payment);
    return paymentResult;
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
