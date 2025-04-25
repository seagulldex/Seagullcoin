
import express from 'express';
import { Client } from 'xrpl';
import { XummSdk } from 'xumm-sdk';  // Corrected import
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Info route to check if API is running
app.get('/api/info', (req, res) => {
    res.send('SeagullCoin NFT Minting API is up and running!');
});

// Minting Endpoint - Ensure SeagullCoin-only minting
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

// Buy NFT Endpoint (SeagullCoin only)
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