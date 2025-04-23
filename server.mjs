import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { NFTStorage, File } from 'nft.storage';
import { Client, xrpToDrops, convertHexToString, convertStringToHex } from 'xrpl';
import fetch from 'node-fetch';
import cors from 'cors';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

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
client.connect();

let mintedNFTs = [];
let collections = [];

app.post('/pay', async (req, res) => {
  const { walletAddress } = req.body;
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

    mintedNFTs.push({ name, image: metadata.image.name, uri, collection: collectionName });
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

async function verifyPayment(walletAddress) {
  const accountTx = await client.request({
    command: "account_tx",
    account: walletAddress,
    ledger_index_min: -1,
    ledger_index_max: -1,
    binary: false,
    limit: 10
  });

  return accountTx.result.transactions.some(tx =>
    tx.tx.TransactionType === "Payment" &&
    tx.tx.Amount?.currency === SGLCN_HEX &&
    tx.tx.Amount?.issuer === SGLCN_ISSUER &&
    parseFloat(tx.tx.Amount?.value || 0) >= 0.5 &&
    tx.tx.Destination === SERVICE_WALLET
  );
}

setInterval(async () => {
  const offers = await client.request({ command: "account_nft_sell_offers", account: SERVICE_WALLET });
  if (offers.result.offers) {
    for (const offer of offers.result.offers) {
      if (offer.amount && typeof offer.amount === "string") {
        // XRP offer - cancel it
        await client.submitAndWait({
          TransactionType: "NFTokenCancelOffer",
          Account: SERVICE_WALLET,
          NFTokenOffers: [offer.nft_offer_index]
        });
      }
    }
  }
}, 30000);

app.listen(PORT, () => {
  console.log(`SGLCN-X20 NFT Minting API running on port ${PORT}`);
});
