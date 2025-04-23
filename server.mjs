import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mime from 'mime-types';
import { config } from 'dotenv';
import { NFTStorage, File } from 'nft.storage';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Client, xrpToDrops, convertHexToString } from 'xrpl';
import { XummSdk } from 'xumm-sdk';
import fs from 'fs';
import path from 'path';

config(); // Load .env

const app = express();
const upload = multer({ dest: 'uploads/' });

const client = new Client('wss://xrplcluster.com');
await client.connect();

const xumm = new XummSdk(process.env.XUMM_API_KEY);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SGLCN_HEX = '53656167756C6C436F696E000000000000000000';
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;

app.use(cors({
  origin: ['https://xrp.cafe', 'https://bidds.com', '*']
}));
app.use(express.json());

// Swagger setup
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'SGLCN-X20 Minting API',
      version: '1.0.0',
      description: 'API for minting NFTs using SeagullCoin (X20) on XRPL'
    }
  },
  apis: ['./server.mjs']
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});
app.use(limiter);

// Endpoint: /pay
app.post('/pay', async (req, res) => {
  const { userWallet } = req.body;
  if (!userWallet) return res.status(400).json({ error: 'Missing wallet address' });

  const tx = {
    TransactionType: 'Payment',
    Destination: SERVICE_WALLET,
    Amount: {
      currency: SGLCN_HEX,
      issuer: SGLCN_ISSUER,
      value: '0.5'
    }
  };

  const payload = await xumm.payload.createAndSubscribe({ txjson: tx }, e => {
    if (e.data.signed === true) {
      return e.data;
    }
  });

  res.json({ uuid: payload.created.uuid, next: payload.created.next.always });
});

// Endpoint: /mint
app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { name, description, wallet, collection } = req.body;
    const file = req.file;

    if (!wallet || !file || !name) return res.status(400).json({ error: 'Missing fields' });

    const data = await fs.promises.readFile(file.path);
    const nftFile = new File([data], file.originalname, { type: mime.lookup(file.originalname) || 'application/octet-stream' });

    const metadata = await nftStorage.store({
      name,
      description,
      image: nftFile,
      properties: { collection }
    });

    const tx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0
    };

    const mintPayload = await xumm.payload.createAndSubscribe({ txjson: tx }, e => {
      if (e.data.signed === true) {
        return e.data;
      }
    });

    res.json({ uuid: mintPayload.created.uuid, next: mintPayload.created.next.always });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mint NFT' });
  }
});

// Endpoint: /user
app.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const nfts = await client.request({
      command: 'account_nfts',
      account: address
    });

    const filtered = nfts.result.account_nfts.filter(n => n.Issuer === SERVICE_WALLET && n.TransferFee === 0);
    const mapped = filtered.map(n => ({
      id: n.NFTokenID,
      uri: Buffer.from(n.URI, 'hex').toString(),
      issuer: n.Issuer
    }));

    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user NFTs' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SGLCN Minting API running on ${PORT}`));
