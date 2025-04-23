const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const xrpl = require('xrpl');
const dotenv = require('dotenv');
const { NFTStorage, File } = require('nft.storage');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For XUMM wallet authentication

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SERVICE_SECRET = process.env.SERVICE_SECRET;
const SEAGULLCOIN_CODE = "SeagullCoin";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_COST = "0.5";
const BURN_WALLET = "r9ByKdPsDznUPPEsmLKvjPdS5qfBSWHEBL"; // hardcoded burn wallet

const xrplClient = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
    endpoints: ["/pay", "/mint", "/collections", "/user/:address", "/buy-nft", "/sell-nft", "/burn"]
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.status(200).json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
    endpoints: ["/pay", "/mint", "/collections", "/user/:address", "/buy-nft", "/sell-nft", "/burn"]
  });
});

// PAY endpoint — checks for SeagullCoin payment to burn wallet
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ success: false, error: 'Missing wallet address' });

  try {
    await xrplClient.connect();

    const transactions = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 20,
    });

    const paymentTx = transactions.result.transactions.find(tx => {
      const t = tx.tx;
      return (
        t.TransactionType === 'Payment' &&
        t.Destination === BURN_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= parseFloat(MINT_COST)
      );
    });

    if (!paymentTx) return res.status(403).json({ success: false, error: 'Payment not found to burn wallet' });

    res.status(200).json({
      success: true,
      txHash: paymentTx.tx.hash,
    });

  } catch (err) {
    console.error('Payment check error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    await xrplClient.disconnect();
  }
});

// /mint - Mint a new NFT after successful payment verification
app.post('/mint', async (req, res) => {
  const { wallet, metadata, xummPayload } = req.body;
  if (!wallet || !metadata || !xummPayload) return res.status(400).json({ success: false, error: 'Missing wallet address, metadata or XUMM payload' });

  try {
    // Verify XUMM Wallet authentication
    const xummResponse = await axios.get(`https://xumm.app/api/v1/platform/payload/${xummPayload}`, {
      headers: { Authorization: `Bearer ${process.env.XUMM_API_KEY}` }
    });

    if (!xummResponse.data?.authenticated) {
      return res.status(401).json({ success: false, error: 'XUMM authentication failed' });
    }

    // Check if the wallet from the payload matches the provided wallet
    if (xummResponse.data?.user.wallet !== wallet) {
      return res.status(401).json({ success: false, error: 'Wallet mismatch with XUMM payload' });
    }

    // Handle NFT minting (e.g., create an NFT on XRPL and store metadata in NFT.Storage)
    const metadataFile = new File([JSON.stringify(metadata)], 'metadata.json', { type: 'application/json' });
    const metadataCID = await nftStorageClient.storeBlob(metadataFile);

    // Mint the NFT
    const nft = await mintNFT(wallet, metadata, metadataCID); // Assume you implement mintNFT()

    res.status(200).json({ success: true, nft });

  } catch (err) {
    console.error('Minting error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// /collections - Return all NFT collections
app.get('/collections', async (req, res) => {
  try {
    // Retrieve all collections from your database/storage (implement getCollections())
    const collections = await getCollections();
    res.status(200).json({ success: true, collections });
  } catch (err) {
    console.error('Error retrieving collections:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// /user/{wallet} - Return user-specific data (NFTs, transactions, etc.)
app.get('/user/:wallet', async (req, res) => {
  const { wallet } = req.params;
  try {
    // Fetch user data such as NFTs, wallet transactions, etc.
    const userData = await getUserData(wallet);
    res.status(200).json({ success: true, userData });
  } catch (err) {
    console.error('Error fetching user data:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// /buy-nft - Handle NFT purchase logic
app.post('/buy-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;
  if (!wallet || !nftId || !price) return res.status(400).json({ success: false, error: 'Missing wallet address, NFT ID, or price' });

  try {
    const purchaseResult = await handleNFTPurchase(wallet, nftId, price);
    res.status(200).json({ success: true, purchaseResult });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// /sell-nft - List NFT for sale
app.post('/sell-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;
  if (!wallet || !nftId || !price) return res.status(400).json({ success: false, error: 'Missing wallet address, NFT ID, or price' });

  try {
    const sellResult = await listNFTForSale(wallet, nftId, price);
    res.status(200).json({ success: true, sellResult });
  } catch (err) {
    console.error('Sell error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// /burn - Handle burning an NFT (transfer to burn wallet)
app.post('/burn', async (req, res) => {
  const { nftId } = req.body;
  if (!nftId) return res.status(400).json({ success: false, error: 'Missing NFT ID' });

  try {
    const burnResult = await burnNFT(nftId);
    res.status(200).json({ success: true, burnResult });
  } catch (err) {
    console.error('Burn error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper functions (you need to implement these)
async function mintNFT(wallet, metadata, metadataCID) {
  // Implement minting logic on XRPL
  // You should create the NFToken here using the xrpl library
  // Assuming successful minting:
  return { wallet, metadata, metadataCID, mintStatus: 'success' }; // Dummy return
}

async function getCollections() {
  // Implement logic to fetch collections
  return [];
}

async function getUserData(wallet) {
  // Implement logic to fetch user data (e.g., NFTs)
  return { wallet, nfts: [] };
}

async function handleNFTPurchase(wallet, nftId, price) {
  // Implement purchase logic here (verify payment, transfer NFT)
  return { wallet, nftId, price, success: true };
}

async function listNFTForSale(wallet, nftId, price) {
  // Implement listing NFT for sale logic
  return { wallet, nftId, price, listed: true };
}

async function burnNFT(nftId) {
  // Implement burning NFT logic
  return { nftId, burned: true };
}

app.listen(PORT, () => {
  console.log(`SGLCN-X20-API running on port ${PORT}`);
});
