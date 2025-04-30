import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import { NFTStorage, File } from 'nft.storage';
import { buffer } from 'node:stream/consumers';
import multer from 'multer';
import { Xumm } from 'xumm';
import { OfferModel } from './models/offerModel.js';
import xrpl from 'xrpl';
import path from 'path';
import fs from 'fs';

dotenv.config();
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const {
  NFT_STORAGE_KEY,
  XUMM_API_KEY,
  XUMM_API_SECRET,
  MONGO_URI,
  SERVICE_WALLET,
  SEAGULLCOIN_ISSUER,
} = process.env;

const client = new xrpl.Client('wss://xrplcluster.com');
const xumm = new Xumm(XUMM_API_KEY, XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: NFT_STORAGE_KEY });

await client.connect();

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => console.error('MongoDB error:', err));

/* === PAY ENDPOINT (Verifies 0.5 SGLCN payment) === */
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  const txs = await client.request({
    command: 'account_tx',
    account: wallet,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: 10,
  });

  const payment = txs.result.transactions.find((tx) =>
    tx.tx.TransactionType === 'Payment' &&
    tx.tx.Destination === SERVICE_WALLET &&
    tx.tx.Amount.currency === '53656167756C6C436F696E000000000000000000' &&
    tx.tx.Amount.issuer === SEAGULLCOIN_ISSUER &&
    parseFloat(tx.tx.Amount.value) >= 0.5
  );

  if (payment) {
    res.json({ success: true, tx: payment.tx.hash });
  } else {
    res.status(402).json({ error: 'Payment not found or insufficient.' });
  }
});

/* === MINT ENDPOINT === */
app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { name, description, wallet, collection, domain, properties } = req.body;

    const image = fs.readFileSync(req.file.path);
    const metadata = await nftStorage.store({
      name,
      description,
      image: new File([image], req.file.originalname, { type: req.file.mimetype }),
      properties: JSON.parse(properties || '{}'),
    });

    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8,
      TransferFee: 0,
      NFTokenTaxon: 0,
    };

    const payload = await xumm.payload.createAndSubscribe(
      {
        txjson: mintTx,
        options: {
          submit: true,
        },
      },
      (event) => {
        if (event.data.signed === true) {
          return event.data;
        }
      }
    );

    fs.unlinkSync(req.file.path); // Clean up uploaded file

    if (payload.resolved.signed) {
      return res.json({ success: true, minted: true, metadata: metadata.url });
    } else {
      return res.status(400).json({ success: false, message: 'Transaction declined' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Minting failed' });
  }
});

/* === MONITOR OFFERS (XRP sell offers rejection logic) === */
setInterval(async () => {
  const offers = await client.request({
    command: 'nft_sell_offers',
    nft_id: '', // optionally monitor specific NFTs
  });

  if (offers.result.offers) {
    for (const offer of offers.result.offers) {
      if (offer.amount && !offer.amount.currency) {
        await client.submit({
          TransactionType: 'NFTokenCancelOffer',
          Account: SERVICE_WALLET,
          NFTokenOffers: [offer.nft_offer_index],
        });
      }
    }
  }
}, 30000);

/* === SAVE NEW OFFERS === */
app.post('/offers', async (req, res) => {
  try {
    const offer = new OfferModel(req.body);
    await offer.save();
    res.json({ success: true, offer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save offer' });
  }
});

/* === FETCH ALL OFFERS === */
app.get('/offers', async (req, res) => {
  const offers = await OfferModel.find();
  res.json(offers);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
