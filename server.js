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
client.connect();

let mintedNFTs = [];
let collections = [];

app.get('/', (req, res) => {
  res.send('Welcome to SGLCN-X20 Minting API');
});

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

app.listen(PORT, () => {
  console.log(`SGLCN-X20 Minting API running on port ${PORT}`);
});
