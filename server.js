const express = require('express');
const bodyParser = require('body-parser');
const xrpl = require('xrpl');
const fetch = require('node-fetch');
const session = require('express-session');
const { XummSdk } = require('xumm-sdk');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(
  session({
    secret: 'seagullcoin-secret',
    resave: false,
    saveUninitialized: true,
  })
);

const xrplClient = new xrpl.Client('wss://s1.ripple.com');
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

const SEAGULLCOIN_CODE = 'SGLCN-X20';
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const BURN_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';
const MINT_COST = 0.5;
const USED_PAYMENTS = new Set(); // In-memory store to avoid double-spends

// === Home Route ===
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the SGLCN-X20 NFT Minting API!' });
});

// === XUMM Login ===
app.get('/login', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' },
    });
    req.session.xummPayloadUuid = payload.uuid;
    res.json({ qr: payload.refs.qr_png, uuid: payload.uuid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create login payload' });
  }
});

// === Collections ===
app.get('/collections', async (req, res) => {
  try {
    const collections = [
      { name: 'Seagull Art', logo: 'seagull_art_logo.png' },
      { name: 'Wildlife NFT', logo: 'wildlife_logo.png' },
    ];
    res.status(200).json(collections);
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// === Mint NFT ===
async function mintNFT(wallet, nftData) {
  const metadata = {
    name: nftData.name,
    description: nftData.description,
    image: nftData.image,
    attributes: nftData.attributes || [],
    collection: nftData.collection || null,
  };

  const metadataRes = await fetch('https://api.nft.storage/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!metadataRes.ok) throw new Error('Failed to upload metadata');
  const metadataJson = await metadataRes.json();
  const ipfsUrl = `https://ipfs.io/ipfs/${metadataJson.value.cid}`;

  const mintTx = {
    TransactionType: 'NFTokenMint',
    Account: wallet,
    URI: xrpl.convertStringToHex(ipfsUrl),
    Flags: 0,
    TokenTaxon: 0,
    TransferFee: 0,
  };

  const preparedTx = await xrplClient.autofill(mintTx);
  const signedTx = wallet.sign(preparedTx);
  const txResult = await xrplClient.submit(signedTx.tx_blob);
  const nftTokenId = txResult.result.tx_json?.NFTokenID;

  return {
    nftTokenId,
    ipfsUrl,
    collection: nftData.collection || 'No Collection',
    mintTxHash: txResult.result.hash,
  };
}

// === /mint endpoint ===
app.post('/mint', async (req, res) => {
  const { wallet, nftData } = req.body;

  if (!req.session.walletAddress || req.session.walletAddress !== wallet) {
    return res.status(401).json({ error: 'Unauthorized: Wallet mismatch or not logged in via XUMM' });
  }

  if (!wallet || !nftData) {
    return res.status(400).json({ error: 'Missing wallet or NFT data' });
  }

  try {
    await xrplClient.connect();

    const txs = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1000,
      ledger_index_max: -1,
      limit: 30,
    });

    const paymentTx = txs.result.transactions.find((tx) => {
      const t = tx.tx;
      return (
        tx.validated &&
        t.TransactionType === 'Payment' &&
        t.Destination === BURN_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= MINT_COST &&
        !USED_PAYMENTS.has(t.hash)
      );
    });

    if (!paymentTx) {
      return res.status(403).json({ success: false, error: 'No valid SeagullCoin payment found to burn wallet' });
    }

    USED_PAYMENTS.add(paymentTx.tx.hash);

    const mintResult = await mintNFT(wallet, nftData);
    res.status(200).json({
      success: true,
      nftTokenId: mintResult.nftTokenId,
      ipfsUrl: mintResult.ipfsUrl,
      collection: mintResult.collection,
      mintTxHash: mintResult.mintTxHash,
      paymentTxHash: paymentTx.tx.hash,
    });
  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ error: 'Minting failed internally' });
  } finally {
    await xrplClient.disconnect();
  }
});

// === /buy-nft endpoint ===
app.post('/buy-nft', async (req, res) => {
  const { wallet, nftId, paymentAmount } = req.body;

  if (!wallet || !nftId || !paymentAmount) {
    return res.status(400).json({ error: 'Missing wallet, NFT ID or payment amount' });
  }

  try {
    await xrplClient.connect();

    const nft = await getNFTById(nftId);
    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    if (nft.owner === wallet) {
      return res.status(400).json({ error: 'You already own this NFT' });
    }

    if (parseFloat(paymentAmount) < nft.price) {
      return res.status(400).json({ error: 'Insufficient funds to purchase NFT' });
    }

    const paymentTx = {
      TransactionType: 'Payment',
      Account: wallet,
      Destination: nft.owner,
      Amount: {
        currency: SEAGULLCOIN_CODE,
        issuer: SEAGULLCOIN_ISSUER,
        value: paymentAmount.toString(),
      },
    };

    const preparedTx = await xrplClient.autofill(paymentTx);
    const signedTx = wallet.sign(preparedTx);
    const txResult = await xrplClient.submit(signedTx.tx_blob);

    await transferNFTOwnership(nftId, wallet);

    res.status(200).json({
      success: true,
      paymentTxHash: txResult.result.hash,
      nftId,
    });
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: 'Error processing purchase' });
  } finally {
    await xrplClient.disconnect();
  }
});

// === /sell-nft endpoint ===
app.post('/sell-nft', async (req, res) => {
  const { wallet, nftId, salePrice } = req.body;

  if (!wallet || !nftId || !salePrice) {
    return res.status(400).json({ error: 'Missing wallet, NFT ID or sale price' });
  }

  try {
    await xrplClient.connect();

    const nft = await getNFTById(nftId);
    if (!nft || nft.owner !== wallet) {
      return res.status(400).json({ error: 'You do not own this NFT' });
    }

    await listNFTForSale(nftId, salePrice);

    res.status(200).json({
      success: true,
      message: 'NFT listed for sale',
      nftId,
      salePrice,
    });
  } catch (err) {
    console.error('Sell error:', err);
    res.status(500).json({ error: 'Error listing NFT for sale' });
  } finally {
    await xrplClient.disconnect();
  }
});

// === Utility Functions ===

// Placeholder for getting NFT by ID
async function getNFTById(nftId) {
  // Retrieve the NFT data from your database or storage
  // Example:
  return { id: nftId, owner: 'some-wallet-address', price: 1.0 };
}

// Placeholder for listing NFT for sale
async function listNFTForSale(nftId, salePrice) {
  // Logic for listing the NFT for sale in your marketplace
  console.log(`Listing NFT ${nftId} for sale at ${salePrice}`);
}

// Placeholder for transferring NFT ownership
async function transferNFTOwnership(nftId, buyerWallet) {
  // Logic for transferring NFT ownership
  console.log(`Transferring NFT ${nftId} to ${buyerWallet}`);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
