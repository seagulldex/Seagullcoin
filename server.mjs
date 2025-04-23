const express = require('express');
const { XummSdk } = require('xumm-sdk');
const { NFTStorage, File } = require('nft.storage');
const { RippleAPI } = require('xrpl');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

const xumm = new XummSdk(process.env.XUMM_API_KEY);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
const xrpl = require('xrpl');

const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233'); // Change to mainnet if needed
client.connect();

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const SEAGULLCOIN_HEX = '53656167756C6C436F696E000000000000000000';


// ---------- TRUSTLINE CHECK (FIXED) ----------
app.get('/check-balance/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;

    const trustlines = await client.request({
      command: 'account_lines',
      account: wallet,
    });

    const seagullLine = trustlines.result.lines.find(
      line =>
        line.currency === 'SeagullCoin' &&
        line.account === SEAGULLCOIN_ISSUER
    );

    const balance = parseFloat(seagullLine?.balance || '0');
    return res.json({ balance });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to check balance' });
  }
});


// ---------- PAYMENT ENDPOINT ----------
app.post('/pay', async (req, res) => {
  try {
    const { wallet } = req.body;

    const txJson = {
      TransactionType: 'Payment',
      Destination: SERVICE_WALLET,
      Amount: {
        currency: SEAGULLCOIN_HEX,
        issuer: SEAGULLCOIN_ISSUER,
        value: '0.5',
      },
    };

    const payload = await xumm.payload.createAndSubscribe(
      {
        txjson: txJson,
        options: {
          return_url: {
            web: 'https://your-site/mint',
          },
          webhook_url: 'https://your-api.glitch.me/xumm-webhook',
        },
      },
      event => {
        if (event.data.signed === true) {
          return event.data;
        }
      }
    );

    return res.json({ payload_uuid: payload.created.uuid, next: payload.created.next.always });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create payment payload' });
  }
});


// ---------- WEBHOOK HANDLER ----------
app.post('/xumm-webhook', async (req, res) => {
  const { payload_uuidv4, signed, response } = req.body;

  console.log('XUMM Webhook Received:', { payload_uuidv4, signed });

  if (signed) {
    // Optional: Mark DB as "paid" or mintable
    console.log(`SeagullCoin payment confirmed for payload ${payload_uuidv4}`);
  }

  res.sendStatus(200);
});


// ---------- NFT MINTING (same) ----------
app.post('/mint', upload.single('media'), async (req, res) => {
  try {
    const { name, description, domain, wallet, collection } = req.body;

    const metadata = {
      name,
      description,
      image: undefined,
      properties: {
        domain,
        collection,
        timestamp: Date.now(),
      },
    };

    const mediaPath = path.join(__dirname, req.file.path);
    const mediaData = fs.readFileSync(mediaPath);
    const mediaFile = new File([mediaData], req.file.originalname, { type: req.file.mimetype });

    const stored = await nftStorage.store({ ...metadata, image: mediaFile });

    fs.unlinkSync(mediaPath);

    // Broadcast minting transaction logic goes here (optional)

    return res.json({
      success: true,
      metadata_url: stored.url,
      ipfs: stored.ipnft,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Minting failed' });
  }
});


// ---------- PLACEHOLDER: BUY/SELL (COMING SOON) ----------
// You can add /buy-nft and /sell-nft routes using NFTokenCreateOffer and NFTokenAcceptOffer with SeagullCoin ONLY

// Example Amount object:
/*
Amount: {
  currency: SEAGULLCOIN_HEX,
  issuer: SEAGULLCOIN_ISSUER,
  value: "12.5"
}
*/


// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SGLCN-X20 Minting API is running on port ${PORT}`);
});
