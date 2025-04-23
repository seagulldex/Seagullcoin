require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { NFTStorage, File } = require('nft.storage');
const { Client, xrpToDrops, convertHexToString, convertStringToHex } = require('xrpl');
const fetch = require('node-fetch');
const cors = require('cors');
const { readFileSync } = require('fs');
const path = require('path');
const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const XRPL_NODE = "wss://s.altnet.rippletest.net:51233"; // Change for mainnet
const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";
const SGLCN_HEX = "53656167756C6C436F696E000000000000000000"; // SeagullCoin currency code
const SGLCN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";

const xummApiKey = process.env.XUMM_API_KEY;
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

const client = new Client(XRPL_NODE);

let mintedNFTs = [];
let collections = [];

(async () => {
  try {
    await client.connect();
    app.listen(PORT, () => {
      console.log(`SGLCN-X20 NFT Minting API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error during server initialization:", error);
  }
})();

// Log request data for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.post('/pay', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    console.log("Processing payment for wallet:", walletAddress);

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
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ error: 'Payment request failed' });
  }
});

app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { name, description, domain, properties, walletAddress, collectionName } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'File required' });

    const hasPaid = await verifyPayment(walletAddress);
    if (!hasPaid) return res.status(403).json({ error: 'SeagullCoin payment not detected' });

    const metadata = {
      name,
      description,
      image: new File([file.buffer], file.originalname, { type: file.mimetype }),
      properties: JSON.parse(properties || "{}"),
      collection: collectionName || "Uncategorized",
      domain
    };

    const ipnft = await nftStorage.store(metadata);
    const uri = `ipfs://${ipnft.ipnft}/metadata.json`;

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

app.get('/collections', (req, res) => {
  const grouped = collections.map(col => ({
    name: col.name,
    icon: col.icon,
    nfts: mintedNFTs.filter(n => n.collection === col.name)
  }));
  res.json(grouped);
});

app.get('/user/:address', (req, res) => {
  const userNfts = mintedNFTs.filter(nft => nft.wallet === req.params.address);
  res.json(userNfts);
});

app.post('/buy-nft', async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error while buying NFT:", err);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

app.post('/sell-nft', async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error while selling NFT:", err);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

async function verifyPayment(walletAddress) {
  try {
    let hasPaid = false;
    let marker = null;

    do {
      const accountTx = await client.request({
        command: "account_tx",
        account: walletAddress,
        ledger_index_min: -1,
        ledger_index_max: -1,
        binary: false,
        limit: 10,
        marker: marker
      });

      hasPaid = accountTx.result.transactions.some(tx =>
        tx.tx.TransactionType === "Payment" &&
        tx.tx.Amount?.currency === SGLCN_HEX &&
        tx.tx.Amount?.issuer === SGLCN_ISSUER &&
        parseFloat(tx.tx.Amount?.value || 0) >= 0.5 &&
        tx.tx.Destination === SERVICE_WALLET
      );

      marker = accountTx.result.marker;

    } while (marker && !hasPaid);

    return hasPaid;
  } catch (err) {
    console.error("Error verifying payment:", err);
    return false;
  }
}

setInterval(async () => {
  try {
    const offers = await client.request({ command: "account_nft_sell_offers", account: SERVICE_WALLET });
    if (offers.result.offers) {
      for (const offer of offers.result.offers) {
        if (offer.amount && (typeof offer.amount === "string" || offer.amount.currency === "XRP")) {
          await client.submitAndWait({
            TransactionType: "NFTokenCancelOffer",
            Account: SERVICE_WALLET,
            NFTokenOffers: [offer.nft_offer_index]
          });
        }
      }
    }
  } catch (err) {
    console.error("Error in offer cancellation:", err);
  }
}, 30000);
