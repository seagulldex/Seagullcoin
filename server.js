const express = require('express');
const axios = require('axios');
const session = require('express-session');
const xrpl = require('xrpl');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));

// Placeholder function to get SeagullCoin balance (replace with actual logic)
async function getSeagullCoinBalance(walletAddress) {
    // Add logic to check balance from SeagullCoin issuer account or XRPL
    return 1.0; // Example balance
}

// Placeholder function to mint NFT (replace with actual logic)
async function mintNFT(walletAddress, nftMetadata) {
    // Add logic to mint an NFT using NFT.Storage, XRPL, etc.
    return { nftId: '123', ...nftMetadata }; // Example NFT data
}

// Placeholder function to retrieve NFT by ID (replace with actual logic)
async function getNFTById(nftId) {
    // Add logic to retrieve NFT from your database or NFT.Storage
    return { id: nftId, owner: 'user_wallet_address' }; // Example NFT
}

// Function to check if user is authenticated via XUMM (use actual logic here)
const checkXummAuth = (xummPayload) => {
    if (!xummPayload || !xummPayload.user) {
        throw new Error('User is not authenticated');
    }
    return xummPayload.user.wallet_address;
};

// Middleware to authenticate XUMM users
app.use(async (req, res, next) => {
    try {
        // Retrieve XUMM payload or session information
        const xummPayload = req.session.xummPayload || req.body.xummPayload;
        
        // Ensure user is authenticated via XUMM
        const userWalletAddress = checkXummAuth(xummPayload);
        req.userWalletAddress = userWalletAddress;

        next();  // Proceed to the next middleware or route
    } catch (error) {
        res.status(401).json({ error: "Unauthorized - XUMM Authentication Failed" });
    }
});

// Route to authenticate users via XUMM (redirect to XUMM for OAuth2)
app.get('/auth/xumm', async (req, res) => {
    try {
        const response = await axios.post('https://xumm.app/api/v1/platform/auth', {}, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.XUMM_API_KEY,
                'x-api-secret': process.env.XUMM_API_SECRET,
            },
        });

        const redirectUrl = response.data.payload_url;
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Error during XUMM OAuth authentication:', error);
        res.status(500).json({ error: 'Error starting XUMM OAuth authentication' });
    }
});

// Callback route to handle the XUMM OAuth2 response
app.get('/auth/xumm/callback', async (req, res) => {
    const { txid } = req.query;

    try {
        const response = await axios.get(`https://xumm.app/api/v1/platform/payload/${txid}`, {
            headers: {
                'x-api-key': process.env.XUMM_API_KEY,
                'x-api-secret': process.env.XUMM_API_SECRET,
            },
        });

        const walletAddress = response.data.response.account;
        
        // Store wallet address in session
        req.session.walletAddress = walletAddress;
        req.session.xummPayload = response.data;

        res.redirect('/');
    } catch (error) {
        console.error('Error during XUMM authentication callback:', error);
        res.status(500).json({ error: 'Error processing XUMM authentication callback' });
    }
});

// Function to sign a transaction with XUMM
async function signTransactionWithXUMM(transaction, signer) {
    const xummApiKey = process.env.XUMM_API_KEY;
    const xummApiSecret = process.env.XUMM_API_SECRET;

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': xummApiKey,
        'x-api-secret': xummApiSecret,
    };

    const payloadRes = await axios.post('https://xumm.app/api/v1/platform/payload', {
        txjson: transaction,
        user_token: signer // optional if using OAuth2-based session
    }, { headers });

    const uuid = payloadRes.data.uuid;

    let signed_blob = null;
    for (let i = 0; i < 20; i++) {
        const statusRes = await axios.get(`https://xumm.app/api/v1/platform/payload/${uuid}`, { headers });
        if (statusRes.data.meta.signed === true) {
            signed_blob = statusRes.data.response.tx_blob;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!signed_blob) throw new Error('User did not sign the transaction in time');

    return signed_blob;
}

// Route to mint NFTs (SeagullCoin payment required)
app.post('/api/mint', async (req, res) => {
    try {
        const { walletAddress, nftMetadata } = req.body;

        if (!walletAddress || !nftMetadata) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Check user's SeagullCoin balance
        const balance = await getSeagullCoinBalance(walletAddress);

        if (balance < 0.5) {
            return res.status(400).json({ error: "Insufficient SeagullCoin balance" });
        }

        // Proceed with minting the NFT after confirming the payment
        const nft = await mintNFT(walletAddress, nftMetadata);

        res.status(200).json({ success: true, message: "NFT minted successfully", nft });
    } catch (error) {
        console.error('Minting error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Route to transfer NFTs
app.post('/api/transfer-nft', async (req, res) => {
    try {
        const { nft_id, fromWallet, toWallet, signer } = req.body;

        if (!nft_id || !fromWallet || !toWallet || !signer) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Validate that the sender wallet is authorized (check if the wallet matches the signer)
        if (fromWallet !== signer) {
            return res.status(403).json({ error: "Unauthorized transfer attempt" });
        }

        // Retrieve the NFT from your database or NFT.Storage
        const nft = await getNFTById(nft_id);
        if (!nft) {
            return res.status(404).json({ error: "NFT not found" });
        }

        // Set up XRPL transaction to transfer the NFT
        const transaction = {
            TransactionType: 'NFTokenCreate',
            Account: fromWallet,
            NFTokenID: nft.id,
            Destination: toWallet,
        };

        // Sign the transaction using XUMM
        const signedTransaction = await signTransactionWithXUMM(transaction, signer);

        // Submit transaction to XRPL
        const response = await submitTransactionToXRPL(signedTransaction);

        if (response.error) {
            return res.status(500).json({ error: "Transaction failed", details: response.error });
        }

        // Confirm successful transfer
        res.status(200).json({ success: true, message: "NFT transferred successfully", tx_id: response.tx_id });
    } catch (err) {
        console.error('Transfer NFT error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);

    if (err.status) {
        return res.status(err.status).json({ error: err.message });
    }

    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

async function submitTransactionToXRPL(signedTxBlob) {
    const client = new xrpl.Client("wss://xrplcluster.com"); // or another XRPL node
    await client.connect();

    try {
        const result = await client.submitAndWait(signedTxBlob);
        return { tx_id: result.result.hash };
    } catch (error) {
        console.error("XRPL submission error:", error);
        return { error: error.message || "Unknown XRPL error" };
    } finally {
        await client.disconnect();
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
