require('dotenv').config();  // Load environment variables from .env
const express = require('express');  // Express framework
const multer = require('multer');  // Multer for file uploads
const { NFTStorage, File } = require('nft.storage');  // For NFT metadata storage
const { Client, xrpToDrops, convertHexToString, convertStringToHex } = require('xrpl');  // XRP Ledger client
const fetch = require('node-fetch');  // For making HTTP requests
const cors = require('cors');  // For handling CORS
const { readFileSync } = require('fs');  // File system operations
const path = require('path');  // For path operations
const app = express();  // Initialize Express app
const upload = multer();  // Set up multer for file upload handling
app.use(cors());  // Allow cross-origin requests
app.use(express.json());  // Parse incoming JSON requests
app.use(express.static('public'));  // Serve static files from 'public' directory

const PORT = process.env.PORT || 3000;  // Port to listen on
const XRPL_NODE = "wss://s.altnet.rippletest.net:51233";  // XRP Ledger node (change to mainnet for production)
const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";  // Service wallet address
const SGLCN_HEX = "53656167756C6C436F696E000000000000000000";  // SeagullCoin currency code in hex
const SGLCN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";  // SeagullCoin issuer address

const xummApiKey = process.env.XUMM_API_KEY;  // XUMM API key from environment variable
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });  // NFT.Storage API client

const client = new Client(XRPL_NODE);  // Connect to the XRP Ledger node

let mintedNFTs = [];  // Array to store minted NFTs
let collections = [];  // Array to store NFT collections

// Start the server
(async () => {
  await client.connect();  // Connect to the XRP Ledger
  app.listen(PORT, () => {
    console.log(`SGLCN-X20 NFT Minting API running on port ${PORT}`);
  });
})();

// Endpoint to handle payment via SeagullCoin
app.post('/pay', async (req, res) => {
  const { walletAddress } = req.body;  // Get wallet address from the request body
  const txJson = {
    TransactionType: 'Payment',
    Destination: SERVICE_WALLET,
    Amount: {
      currency: SGLCN_HEX,
      issuer: SGLCN_ISSUER,
      value: "0.5"
    },
    Memos: [{ Memo: { MemoData: Buffer.from('Minting fee').toString('hex') } }]
  };

  const payload = await fetch("https://xumm.app/api/v1/platform/payload", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': xummApiKey
    },
    body: JSON.stringify({ txjson: txJson, options: { submit: true } })
  });

  const json = await payload.json();
  res.json({ uuid: json.uuid, next: json.next.always });
});

// Endpoint to mint an NFT
app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { name, description, domain, properties, walletAddress, collectionName } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'File required' });

    const hasPaid = await verifyPayment(walletAddress);
    if (!hasPaid) return res.status(403).json({ error: 'SeagullCoin payment not detected' });

    // Prepare metadata for the NFT
    const metadata = {
      name,
      description,
      image: new File([file.buffer], file.originalname, { type: file.mimetype }),
      properties: JSON.parse(properties || "{}"),
      collection: collectionName || "Uncategorized",
      domain
    };

    // Store the NFT metadata on NFT.Storage
    const ipnft = await nftStorage.store(metadata);
    const uri = `ipfs://${ipnft.ipnft}/metadata.json`;

    // Create the transaction to mint the NFT
    const tx = {
      TransactionType: "NFTokenMint",
      Account: walletAddress,
      URI: Buffer.from(uri).toString('hex').toUpperCase(),
      Flags: 8,
      TransferFee: 0,
      NFTokenTaxon: 0,
      Memos: [{
        Memo: {
          MemoData: Buffer.from(`Minted with SGLCN`).toString("hex")
        }
      }]
    };

    const payload = await fetch("https://xumm.app/api/v1/platform/payload", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': xummApiKey
      },
      body: JSON.stringify({ txjson: tx, options: { submit: true } })
    });

    mintedNFTs.push({ name, image: metadata.image.name, uri, collection: collectionName, wallet: walletAddress });
    if (collectionName && !collections.find(c => c.name === collectionName)) {
      collections.push({ name: collectionName, icon: "/default-icon.png" });
    }

    res.json({ uuid: payload.uuid, next: payload.next.always });
  } catch (err) {
    console.error("Minting error:", err);
    res.status(500).json({ error: "Mint failed" });
  }
});

// Endpoint to get all collections
app.get('/collections', (req, res) => {
  const grouped = collections.map(col => ({
    name: col.name,
    icon: col.icon,
    nfts: mintedNFTs.filter(n => n.collection === col.name)
  }));
  res.json(grouped);
});

// Endpoint to get NFTs by user address
app.get('/user/:address', (req, res) => {
  const userNfts = mintedNFTs.filter(nft => nft.wallet === req.params.address);
  res.json(userNfts);
});

// Endpoint for buying an NFT
app.post('/buy-nft', async (req, res) => {
  const { buyerAddress, sellerAddress, amount, tokenId } = req.body;

  const tx = {
    TransactionType: "NFTokenCreateOffer",
    Account: buyerAddress,
    Owner: sellerAddress,
    NFTokenID: tokenId,
    Amount: {
      currency: SGLCN_HEX,
      issuer: SGLCN_ISSUER,
      value: amount.toString()
    },
    Flags: 1
  };

  const payload = await fetch("https://xumm.app/api/v1/platform/payload", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': xummApiKey
    },
    body: JSON.stringify({ txjson: tx, options: { submit: true } })
  });

  res.json({ uuid: payload.uuid, next: payload.next.always });
});

// Endpoint for selling an NFT
app.post('/sell-nft', async (req, res) => {
  const { sellerAddress, tokenId, price } = req.body;

  const tx = {
    TransactionType: "NFTokenCreateOffer",
    Account: sellerAddress,
    NFTokenID: tokenId,
    Amount: {
      currency: SGLCN_HEX,
      issuer: SGLCN_ISSUER,
      value: price.toString()
    },
    Flags: 1
  };

  const payload = await fetch("https://xumm.app/api/v1/platform/payload", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': xummApiKey
    },
    body: JSON.stringify({ txjson: tx, options: { submit: true } })
  });

  res.json({ uuid: payload.uuid, next: payload.next.always });
});

// Verify payment of SeagullCoin to the service wallet
async function verifyPayment(walletAddress) {
  try {
    let hasPaid = false;
    let marker = null;

    // Loop to handle pagination in case there are more than 10 transactions
    do {
      const accountTx = await client.request({
        command: "account_tx",
        account: walletAddress,
        ledger_index_min: -1,
        ledger_index_max: -1,
        binary: false,
        limit: 10,
        marker: marker  // Set marker to fetch the next page of results
      });

      // Check if any transaction meets the payment criteria
      hasPaid = accountTx.result.transactions.some(tx =>
        tx.tx.TransactionType === "Payment" &&
        tx.tx.Amount?.currency === SGLCN_HEX &&
        tx.tx.Amount?.issuer === SGLCN_ISSUER &&
        parseFloat(tx.tx.Amount?.value || 0) >= 0.5 &&
        tx.tx.Destination === SERVICE_WALLET
      );

      // Update the marker to fetch the next page of transactions
      marker = accountTx.result.marker;

    } while (marker && !hasPaid);  // Continue pagination until payment is found or no more transactions

    return hasPaid;
  } catch (err) {
    console.error("Error verifying payment:", err);
    return false;
  }
}

// Periodic check for unauthorized XRP offers
setInterval(async () => {
  const offers = await client.request({ command: "account_nft_sell_offers", account: SERVICE_WALLET });
  if (offers.result.offers) {
    for (const offer of offers.result.offers) {
      if (offer.amount && (typeof offer.amount === "string" || offer.amount.currency === "XRP")) {
        // XRP offer - cancel it
        await client.submitAndWait({
          TransactionType: "NFTokenCancelOffer",
          Account: SERVICE_WALLET,
          NFTokenOffers: [offer.nft_offer_index]
        });
      }
    }
  }
}, 30000);  // Run every 30 seconds

