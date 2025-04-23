require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { XummSdk } = require('xumm-sdk');
const xrpl = require('xrpl');
const cors = require('cors');
const { NFTStorage, File } = require('nft.storage');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

const SERVICE_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';
const SGLCN_HEX = '53656167756C6C436F696E000000000000000000';
const SGLCN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const MINT_COST = '0.5';

let mintedNFTs = [];

// Root route for the base URL
app.get('/', (req, res) => {
  res.json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
    url: "https://sglcn-x20-api.glitch.me",
    endpoints: [
      "/pay",
      "/mint",
      "/collections",
      "/user/:address",
      "/buy-nft",
      "/sell-nft"
    ]
  });
});

app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

  const tx = {
    TransactionType: 'Payment',
    Destination: SERVICE_WALLET,
    Amount: {
      currency: SGLCN_HEX,
      issuer: SGLCN_ISSUER,
      value: MINT_COST
    }
  };

  const payload = await xumm.payload.createAndSubscribe({ txjson: tx }, event => {
    if (event.data.signed === true) {
      return event;
    }
  });

  res.json({
    uuid: payload.uuid,
    next: payload.next.always,
  });
});

app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { wallet, name, description, domain, collection, properties } = req.body;

    if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

    const filePath = req.file.path;
    const fileData = await fs.promises.readFile(filePath);
    const fileMime = req.file.mimetype;
    const fileName = req.file.originalname;

    const metadata = {
      name,
      description,
      image: new File([fileData], fileName, { type: fileMime }),
      properties: JSON.parse(properties || '{}'),
      collection,
      domain,
    };

    const metadataCID = await nftStorage.store(metadata);

    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    const nftMintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      URI: xrpl.convertStringToHex(`ipfs://${metadataCID.url.split('/').pop()}`),
      Flags: 8,
      TransferFee: 0,
      NFTokenTaxon: 0,
    };

    const response = await client.autofill(nftMintTx);
    const signed = await client.sign(response, { seed: process.env.SERVICE_WALLET_SEED });
    const submit = await client.submitAndWait(signed.tx_blob);
    const tokenId = submit.result.meta?.nftoken_id || null;

    await client.disconnect();

    mintedNFTs.push({
      name,
      description,
      tokenId,
      image: metadataCID.data.image.href,
      collection,
      domain,
    });

    fs.unlinkSync(filePath);

    res.json({ success: true, tokenId });
  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ error: 'Minting failed' });
  }
});

app.get('/nfts', async (req, res) => {
  res.json({ nfts: mintedNFTs });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(JSON.stringify({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
    url: "https://sglcn-x20-api.glitch.me",
    endpoints: [
      "/pay",
      "/mint",
      "/collections",
      "/user/:address",
      "/buy-nft",
      "/sell-nft"
    ]
  }, null, 2));
});
