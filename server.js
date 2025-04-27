// server.js

// Dependencies
const express = require('express');
const multer = require('multer');
const { NFTStorage, File } = require('nft.storage');
const xrpl = require('xrpl');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// Setup app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants
const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY;
const XRPL_SERVER = 'wss://xrplcluster.com';
const SERVICE_WALLET_ADDRESS = process.env.SERVICE_WALLET_ADDRESS;
const SERVICE_WALLET_SECRET = process.env.SERVICE_WALLET_SECRET;
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const SEAGULLCOIN_CURRENCY = "SeagullCoin";

// File uploads
const upload = multer({ dest: 'uploads/' });
const nftStorageClient = new NFTStorage({ token: NFT_STORAGE_API_KEY });

/**
 * Upload file + metadata to IPFS
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { name, description } = req.body;
        const filePath = path.join(__dirname, req.file.path);

        const fileData = await fs.promises.readFile(filePath);
        const fileType = req.file.mimetype;

        const nftFile = new File([fileData], req.file.originalname, { type: fileType });
        const mediaCid = await nftStorageClient.storeBlob(nftFile);
        const mediaUrl = `ipfs://${mediaCid}`;

        const metadata = {
            name,
            description,
            image: mediaUrl
        };

        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
        const metadataCid = await nftStorageClient.storeBlob(metadataFile);
        const metadataUrl = `ipfs://${metadataCid}`;

        await fs.promises.unlink(filePath);

        res.json({
            success: true,
            media_url: mediaUrl,
            metadata_url: metadataUrl
        });
    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).json({ error: 'Failed to upload NFT' });
    }
});

/**
 * Verify SeagullCoin payment
 */
async function verifySeagullCoinPayment(account, expectedAmount) {
    const client = new xrpl.Client(XRPL_SERVER);
    await client.connect();

    try {
        const payments = await client.request({
            command: "account_tx",
            account: SERVICE_WALLET_ADDRESS,
            ledger_index_min: -1,
            ledger_index_max: -1,
            limit: 20
        });

        const transactions = payments.result.transactions;
        for (let tx of transactions) {
            if (tx.tx.TransactionType === "Payment" &&
                tx.tx.Account === account &&
                tx.tx.Destination === SERVICE_WALLET_ADDRESS &&
                tx.tx.Amount.currency === SEAGULLCOIN_CURRENCY &&
                tx.tx.Amount.issuer === SEAGULLCOIN_ISSUER &&
                parseFloat(tx.tx.Amount.value) >= expectedAmount) {
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error('Payment verification error:', err);
        return false;
    } finally {
        client.disconnect();
    }
}

/**
 * Mint NFT
 */
app.post('/api/mint', async (req, res) => {
    const { walletAddress, metadataUrl } = req.body;

    if (!walletAddress || !metadataUrl) {
        return res.status(400).json({ error: "Missing walletAddress or metadataUrl" });
    }

    const paymentVerified = await verifySeagullCoinPayment(walletAddress, 0.5);
    if (!paymentVerified) {
        return res.status(403).json({ error: "SeagullCoin payment not verified" });
    }

    const client = new xrpl.Client(XRPL_SERVER);
    await client.connect();

    try {
        const serviceWallet = xrpl.Wallet.fromSeed(SERVICE_WALLET_SECRET);

        const mintTx = {
            TransactionType: "NFTokenMint",
            Account: serviceWallet.classicAddress,
            URI: xrpl.convertStringToHex(metadataUrl),
            Flags: 8, // Transferable
            NFTokenTaxon: 0
        };

        const prepared = await client.autofill(mintTx);
        const signed = serviceWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta.TransactionResult === "tesSUCCESS") {
            const createdNodes = result.result.meta.AffectedNodes.filter(node => node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFTokenPage');
            const nftokenId = createdNodes[0]?.CreatedNode?.NewFields?.NFTokens[0]?.NFToken?.NFTokenID;
            res.json({ success: true, nftokenId });
        } else {
            res.status(500).json({ error: "NFT Minting failed" });
        }
    } catch (err) {
        console.error('Mint error:', err);
        res.status(500).json({ error: "Minting failed" });
    } finally {
        client.disconnect();
    }
});

/**
 * Create SeagullCoin Sell Offer
 */
app.post('/api/sell', async (req, res) => {
    const { nftokenId, amount } = req.body;

    if (!nftokenId || !amount) {
        return res.status(400).json({ error: "Missing nftokenId or amount" });
    }

    const client = new xrpl.Client(XRPL_SERVER);
    await client.connect();

    try {
        const serviceWallet = xrpl.Wallet.fromSeed(SERVICE_WALLET_SECRET);

        const offerTx = {
            TransactionType: "NFTokenCreateOffer",
            Account: serviceWallet.classicAddress,
            NFTokenID: nftokenId,
            Amount: {
                currency: SEAGULLCOIN_CURRENCY,
                issuer: SEAGULLCOIN_ISSUER,
                value: amount.toString()
            },
            Flags: 1 // Sell offer
        };

        const prepared = await client.autofill(offerTx);
        const signed = serviceWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta.TransactionResult === "tesSUCCESS") {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: "Failed to create sell offer" });
        }
    } catch (err) {
        console.error('Sell error:', err);
        res.status(500).json({ error: "Sell offer failed" });
    } finally {
        client.disconnect();
    }
});

/**
 * Auto cancel any unauthorized XRP sell offers
 */
async function cancelUnauthorizedXrpOffers() {
    const client = new xrpl.Client(XRPL_SERVER);
    await client.connect();

    try {
        const serviceWallet = xrpl.Wallet.fromSeed(SERVICE_WALLET_SECRET);

        const offers = await client.request({
            command: "account_nft_sell_offers",
            account: serviceWallet.classicAddress
        });

        if (!offers.result.offers) return;

        for (let offer of offers.result.offers) {
            const isXrp = typeof offer.amount === 'string'; // if it's a string, it's XRP

            if (isXrp) {
                console.log('Unauthorized XRP offer found, cancelling:', offer.nft_offer_index);

                const cancelTx = {
                    TransactionType: "NFTokenCancelOffer",
                    Account: serviceWallet.classicAddress,
                    NFTokenOffers: [offer.nft_offer_index]
                };

                const prepared = await client.autofill(cancelTx);
                const signed = serviceWallet.sign(prepared);
                await client.submitAndWait(signed.tx_blob);
            }
        }
    } catch (err) {
        console.error('Cancel unauthorized XRP offers error:', err);
    } finally {
        client.disconnect();
    }
}

// Optional: run every 5 mins
setInterval(cancelUnauthorizedXrpOffers, 5 * 60 * 1000);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
