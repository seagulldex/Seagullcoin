import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { NFTStorage, File } from 'nft.storage';
import { Client, Wallet } from 'xrpl';
import { XummSdk } from 'xumm-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const client = new Client('wss://xrpl.ws');
const xumm = new XummSdk(process.env.XUMM_API_KEY);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SERVICE_SECRET = process.env.SERVICE_SECRET;
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;
const SGLCN_HEX = process.env.SGLCN_HEX;
const SGLCN_COST = '0.5';

app.use(cors({
  origin: ['https://bidds.com', 'https://xrp.cafe', 'https://outgoing-destiny-bladder.glitch.me'],
  credentials: true
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'SGLCN-X20 Minting API',
      version: '1.0.0',
      description: 'Mint NFTs using SeagullCoin only on XRPL',
    },
    servers: [{ url: 'https://outgoing-destiny-bladder.glitch.me' }],
  },
  apis: [__filename],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Auth middleware
async function verifyXummUser(req, res, next) {
  const xummToken = req.headers['xumm-token'];
  if (!xummToken) return res.status(401).json({ error: 'Missing token' });
  try {
    const user = await xumm.getUserToken(xummToken);
    if (!user || !user.sub) return res.status(403).json({ error: 'Invalid token' });
    req.wallet = user.sub;
    next();
  } catch {
    res.status(403).json({ error: 'Auth failed' });
  }
}

// Routes (same as before)
app.post('/pay', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: SERVICE_WALLET,
        Amount: {
          currency: SGLCN_HEX,
          issuer: SGLCN_ISSUER,
          value: SGLCN_COST,
        },
      },
    });
    res.json({ uuid: payload.uuid, next: payload.next.always });
  } catch (err) {
    res.status(500).json({ error: 'Payment creation failed', details: err.message });
  }
});

app.post('/mint', verifyXummUser, async (req, res) => {
  const { name, description, imageBase64, domain, properties, collection } = req.body;
  if (!name || !imageBase64) return res.status(400).json({ error: 'Missing name/image' });

  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const metadata = {
      name,
      description,
      image: new File([imageBuffer], 'nft.png', { type: 'image/png' }),
      properties,
      domain,
      collection,
    };
    const result = await nftStorage.store(metadata);
    const cid = result.ipnft;
    const uri = 'ipfs://' + cid;
    const uriHex = Buffer.from(uri).toString('hex').toUpperCase();

    await client.connect();
    const wallet = Wallet.fromSeed(SERVICE_SECRET);
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: wallet.classicAddress,
      URI: uriHex,
      Flags: 8,
      NFTokenTaxon: 0,
    };
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const submission = await client.submitAndWait(signed.tx_blob);
    await client.disconnect();

    const nftId = submission.result.meta?.nftoken_id;
    res.json({ success: true, cid: uri, nftId });
  } catch (err) {
    res.status(500).json({ error: 'Minting failed', details: err.message });
  }
});

app.get('/user', verifyXummUser, (req, res) => {
  res.json({ wallet: req.wallet });
});

app.post('/offers/monitor', async (req, res) => {
  const { nftId } = req.body;
  if (!nftId) return res.status(400).json({ error: 'Missing NFT ID' });

  try {
    await client.connect();
    const offers = await client.request({ command: 'nft_sell_offers', nft_id: nftId });
    const wallet = Wallet.fromSeed(SERVICE_SECRET);

    for (const offer of offers.result.offers || []) {
      if (offer.amount && !offer.amount.issuer) {
        const cancelTx = {
          TransactionType: 'NFTokenCancelOffer',
          Account: wallet.classicAddress,
          NFTokenOffers: [offer.nft_offer_index],
        };
        const prepared = await client.autofill(cancelTx);
        const signed = wallet.sign(prepared);
        await client.submitAndWait(signed.tx_blob);
      }
    }
    await client.disconnect();
    res.json({ success: true, canceled: offers.result.offers?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Offer check failed', details: e.message });
  }
});

app.get('/', (req, res) => {
  res.send('SGLCN-X20 Minting API is live');
});

app.listen(port, () => console.log(`API running on http://localhost:${port}`));
