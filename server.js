const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { XummSdk } = require('xumm-sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_SECRET_KEY = process.env.XUMM_SECRET_KEY;
const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY;
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const SEAGULLCOIN_CURRENCY = 'SeagullCoin';

const xummSdk = new XummSdk(XUMM_API_KEY, XUMM_SECRET_KEY);
app.use(bodyParser.json());

// Directories for NFT metadata and listings
const nftDirectory = path.join(__dirname, 'nfts');
const listingsDirectory = path.join(__dirname, 'listings');

// Ensure the directories exist or create them
if (!fs.existsSync(nftDirectory)) {
    fs.mkdirSync(nftDirectory, { recursive: true });
    console.log('NFT directory created');
}

if (!fs.existsSync(listingsDirectory)) {
    fs.mkdirSync(listingsDirectory, { recursive: true });
    console.log('Listings directory created');
}

// Swagger UI setup
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware for XUMM authentication
const checkXummAuth = (req, res, next) => {
    const xummPayload = req.headers['x-xumm-payload'];
    if (!xummPayload) return res.status(403).json({ message: 'Unauthorized' });

    xummSdk.payload.get(xummPayload)
        .then(response => {
            req.user = response.data.account;
            next();
        })
        .catch(error => res.status(500).json({ message: 'XUMM authentication failed', error }));
};

// Minting route - Enforces 0.5 SeagullCoin fee
app.post('/mint', checkXummAuth, async (req, res) => {
    const { nftMetadata, collection, properties } = req.body;

    try {
        // Enforce 0.5 SeagullCoin payment
        const userBalance = await checkUserBalance(req.user);
        if (userBalance < 0.5) return res.status(400).json({ message: 'Insufficient SeagullCoin balance' });

        // Mint NFT to user
        const nftData = await mintNFT(req.user, nftMetadata, collection, properties);
        res.status(200).json({ message: 'NFT Minted Successfully', nftId: nftData.nftId });
    } catch (error) {
        res.status(500).json({ message: 'Minting failed', error });
    }
});

// Payment verification - Ensure 0.5 SeagullCoin
const checkUserBalance = async (address) => {
    try {
        const response = await axios.get(`https://xumm.app/api/v1/accounts/${address}/balances`);
        const seagullCoinBalance = response.data.find(balance => balance.currency === SEAGULLCOIN_CURRENCY);
        return seagullCoinBalance ? seagullCoinBalance.value : 0;
    } catch (error) {
        throw new Error('Balance check failed');
    }
};

// Mint NFT function
const mintNFT = async (address, metadata, collection, properties) => {
    try {
        // Logic to mint NFT to address, use NFT.Storage for metadata and media storage
        const nftData = await axios.post('https://api.nft.storage/upload', metadata, {
            headers: {
                'Authorization': `Bearer ${NFT_STORAGE_API_KEY}`
            }
        });

        // Save the NFT to your system with collection info and properties
        const nftId = await saveNFTData(nftData, collection, properties);
        return { nftId };
    } catch (error) {
        throw new Error('NFT minting failed');
    }
};

// Save NFT metadata and properties
const saveNFTData = async (nftData, collection, properties) => {
    const nftId = Date.now(); // Example ID, use your actual NFT storage logic here
    const nftInfo = {
        nftId,
        metadata: nftData,
        collection,
        properties
    };

    fs.writeFileSync(path.join(nftDirectory, `${nftId}.json`), JSON.stringify(nftInfo));

    return nftId;
};

// Helper function to get NFT data by ID
const getNFTData = async (nftId) => {
    try {
        const filePath = path.join(nftDirectory, `${nftId}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return null; // If NFT data not found
    } catch (error) {
        throw new Error('Error fetching NFT data');
    }
};

// Listing NFT for sale (only in SeagullCoin)
app.post('/list-nft', checkXummAuth, async (req, res) => {
    const { nftId, price } = req.body;

    if (price <= 0) {
        return res.status(400).json({ message: 'Price must be greater than 0' });
    }

    try {
        // Ensure the price is in SeagullCoin
        const nftData = await getNFTData(nftId);  // Use the getNFTData function
        if (!nftData) return res.status(404).json({ message: 'NFT not found' });

        const listingData = {
            nftId,
            seller: req.user,
            price,
            currency: SEAGULLCOIN_CURRENCY,
        };

        // Save listing to system (could be a database or a simple file system store)
        await saveNFTListing(listingData);

        res.status(200).json({ message: 'NFT listed successfully', listing: listingData });
    } catch (error) {
        res.status(500).json({ message: 'Error listing NFT', error });
    }
});

// Buying NFT with SeagullCoin
app.post('/buy-nft', checkXummAuth, async (req, res) => {
    const { nftId, price } = req.body;

    try {
        // Fetch the listing
        const listing = await getNFTListing(nftId);

        if (!listing || listing.price !== price || listing.currency !== SEAGULLCOIN_CURRENCY) {
            return res.status(400).json({ message: 'Invalid listing or price mismatch' });
        }

        // Ensure buyer has sufficient SeagullCoin balance
        const buyerBalance = await checkUserBalance(req.user);
        if (buyerBalance < price) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Process the transaction (transfer SeagullCoin from buyer to seller)
        await transferSeagullCoin(req.user, listing.seller, price);

        // Transfer NFT to buyer
        await transferNFT(nftId, req.user);

        res.status(200).json({ message: 'NFT purchased successfully', nftId });
    } catch (error) {
        res.status(500).json({ message: 'Error buying NFT', error });
    }
});

// Helper function to get NFT listing by ID
const getNFTListing = async (nftId) => {
    try {
        const filePath = path.join(listingsDirectory, `${nftId}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return null;
    } catch (error) {
        throw new Error('Error fetching NFT listing');
    }
};

// Helper function to save NFT listing
const saveNFTListing = async (listingData) => {
    const listingPath = path.join(listingsDirectory, `${listingData.nftId}.json`);
    fs.writeFileSync(listingPath, JSON.stringify(listingData));
};

// Transfer SeagullCoin (handle SeagullCoin transactions)
const transferSeagullCoin = async (from, to, amount) => {
    // Implement logic to transfer SeagullCoin using the XUMM SDK or directly via XRPL
    console.log(`Transferring ${amount} SeagullCoin from ${from} to ${to}`);
    // XUMM transaction to transfer SeagullCoin...
};

// Transfer NFT (handle NFT transfer)
const transferNFT = async (nftId, to) => {
    console.log(`Transferring NFT ${nftId} to ${to}`);
    // Implement the logic to transfer NFT ownership...
};

// Serve the frontend
app.use(express.static('public'));

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
