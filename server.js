const express = require('express');
const bodyParser = require('body-parser');
const { getSeagullCoinBalance, getNFTById } = require('./utils'); // Import utility functions

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Sample Swagger Documentation for /buy-nft and /sell-nft
app.get('/swagger', (req, res) => {
  res.send(`
    <h2>Swagger Documentation</h2>
    <pre>
      swagger: "2.0"
      info:
        description: "API documentation for SeagullCoin NFT Minting and Marketplace"
        version: "1.0.0"
        title: "SeagullCoin NFT Marketplace API"
      paths:
        /api/buy-nft:
          post:
            summary: "Buy an NFT with SeagullCoin"
            description: "Place an offer to buy an NFT with SeagullCoin."
            parameters:
              - name: "nftId"
                in: "body"
                description: "The ID of the NFT to buy."
                required: true
                schema:
                  type: "string"
              - name: "offerAmount"
                in: "body"
                description: "The amount of SeagullCoin offered to buy the NFT."
                required: true
                schema:
                  type: "number"
              - name: "buyerWallet"
                in: "body"
                description: "The wallet address of the buyer."
                required: true
                schema:
                  type: "string"
            responses:
              200:
                description: "Buy offer successfully placed"
              400:
                description: "Invalid parameters or insufficient SeagullCoin balance"
              500:
                description: "Internal server error"

        /api/sell-nft:
          post:
            summary: "List an NFT for sale with SeagullCoin"
            description: "Place an NFT on sale for a specified amount of SeagullCoin."
            parameters:
              - name: "nftId"
                in: "body"
                description: "The ID of the NFT to list for sale."
                required: true
                schema:
                  type: "string"
              - name: "salePrice"
                in: "body"
                description: "The SeagullCoin price for the NFT."
                required: true
                schema:
                  type: "number"
              - name: "sellerWallet"
                in: "body"
                description: "The wallet address of the seller."
                required: true
                schema:
                  type: "string"
            responses:
              200:
                description: "NFT listed for sale successfully"
              400:
                description: "Invalid parameters or insufficient SeagullCoin balance"
              500:
                description: "Internal server error"
    </pre>
  `);
});

// Mint an NFT route
app.post('/api/mint', async (req, res) => {
    try {
        const { walletAddress, nftMetadata } = req.body;

        if (!walletAddress || !nftMetadata) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Assuming SeagullCoin payment is handled separately before minting

        // Mint the NFT (calling your minting logic, e.g., interacting with XRPL)
        const nftId = await mintNFT(walletAddress, nftMetadata);
        
        res.status(200).json({ success: true, nftId });
    } catch (error) {
        console.error("Minting error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Buy NFT route
app.post('/api/buy-nft', async (req, res) => {
    try {
        const { nftId, offerAmount, buyerWallet } = req.body;

        if (!nftId || !offerAmount || !buyerWallet) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Ensure the user has sufficient SeagullCoin balance
        const balance = await getSeagullCoinBalance(buyerWallet);
        if (balance < offerAmount) {
            return res.status(400).json({ error: "Insufficient SeagullCoin balance" });
        }

        // Fetch the NFT from the database or storage
        const nft = await getNFTById(nftId);
        if (!nft) {
            return res.status(404).json({ error: "NFT not found" });
        }

        // Logic to handle the purchase (e.g., creating a transaction to transfer SeagullCoin)
        // Here we assume the transaction is successful, so we will just mock the process

        // Proceed with the buy offer
        const success = await placeBuyOffer(buyerWallet, nftId, offerAmount);

        if (!success) {
            return res.status(500).json({ error: "Failed to place buy offer" });
        }

        res.status(200).json({ success: true, message: "NFT bought successfully" });
    } catch (error) {
        console.error("Buy NFT error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Sell NFT route
app.post('/api/sell-nft', async (req, res) => {
    try {
        const { nftId, salePrice, sellerWallet } = req.body;

        if (!nftId || !salePrice || !sellerWallet) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Fetch the NFT and ensure the seller owns it
        const nft = await getNFTById(nftId);
        if (!nft || nft.owner !== sellerWallet) {
            return res.status(404).json({ error: "NFT not found or you do not own it" });
        }

        // Logic to list the NFT for sale (e.g., save to your database)
        const success = await listNFTForSale(nftId, salePrice);

        if (!success) {
            return res.status(500).json({ error: "Failed to list NFT for sale" });
        }

        res.status(200).json({ success: true, message: "NFT listed for sale successfully" });
    } catch (error) {
        console.error("Sell NFT error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Utility function to mint an NFT (this needs to be implemented)
async function mintNFT(walletAddress, nftMetadata) {
    // Implement actual minting logic here
    return "nft123"; // Mock NFT ID
}

// Utility function to place a buy offer (this needs to be implemented)
async function placeBuyOffer(buyerWallet, nftId, offerAmount) {
    // Implement logic to place a buy offer for the NFT (SeagullCoin transfer logic)
    return true; // Mock success
}

// Utility function to list NFT for sale (this needs to be implemented)
async function listNFTForSale(nftId, salePrice) {
    // Implement logic to list the NFT for sale
    return true; // Mock success
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
