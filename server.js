// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client } from 'xrpl';
import { XummSdk } from 'xumm-sdk';
import { NFTStorage, File } from 'nft.storage';
import multer from 'multer';
import fs from 'fs/promises';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;
const NFT_STORAGE_KEY = process.env.NFT_STORAGE_KEY;
const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const SEAGULLCOIN_CURRENCY = "53656167756C6C436F696E000000000000000000"; // Hex for "SeagullCoin"
const NETWORK = 'wss://xrplcluster.com'; // Public XRPL node

const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET);
const client = new Client(NETWORK);
const nftStorage = new NFTStorage({ token: NFT_STORAGE_KEY });

await client.connect();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(join(__dirname, 'public')));

// Multer setup (file uploads)
const upload = multer({ dest: 'uploads/' });

// --------- Helper Functions ---------

async function hasTrustline(address) {
  const account = await client.request({
    command: 'account_lines',
    account: address
  });
  return account.result.lines.some(
    line => line.currency === Buffer.from(SEAGULLCOIN_CURRENCY, 'hex').toString('utf8') &&
            line.account === SEAGULLCOIN_ISSUER
  );
}

async function checkSeagullCoinPayment(address) {
  const txs = await client.request({
    command: 'account_tx',
    account: SERVICE_WALLET,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: 10
  });
  const payment = txs.result.transactions.find(tx => 
    tx.tx.TransactionType === 'Payment' &&
    tx.tx.Account === address &&
    tx.tx.Amount.currency === 'SeagullCoin' &&
    tx.tx.Amount.issuer === SEAGULLCOIN_ISSUER &&
    parseFloat(tx.tx.Amount.value) >= 0.5
  );
  return payment !== undefined;
}

async function cancelUnauthorizedOffers(nftokenId) {
  const offers = await client.request({
    command: 'nft_sell_offers',
    nft_id: nftokenId
  });

  if (offers.result.offers) {
    for (const offer of offers.result.offers) {
      if (offer.amount && !offer.amount.currency) {
        // XRP offer detected — cancel it
        console.log(`Cancelling unauthorized XRP offer: ${offer.nft_offer_index}`);
        // You should implement offer cancellation via your service wallet
      }
    }
  }
}

// --------- API Routes ---------

const apiRouter = express.Router();

// 1. Get XUMM payload to connect user
apiRouter.post('/connect', async (req, res) => {
  try {
    const payload = {
      txjson: {
        TransactionType: 'SignIn'
      }
    };
    const created = await xumm.payload.createAndSubscribe(payload, event => {
      if (event.data.signed === true) {
        return event.data;
      }
    });
    res.json({ qr: created.created.refs.qr_png, uuid: created.created.uuid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create XUMM payload.' });
  }
});

// 2. Fetch user info after XUMM sign
apiRouter.get('/user/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const result = await xumm.payload.get(uuid);
    const address = result.response.account;
    res.json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user info.' });
  }
});

// 3. SeagullCoin payment verification
apiRouter.get('/pay/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const paid = await checkSeagullCoinPayment(address);
    res.json({ paid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// 4. Mint NFT
apiRouter.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { address, name, description, domain, properties, collection } = req.body;
    const filePath = req.file.path;

    if (!await hasTrustline(address)) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Wallet must trust SeagullCoin first.' });
    }

    if (!await checkSeagullCoinPayment(address)) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Minting requires 0.5 SeagullCoin payment.' });
    }

    const fileData = await fs.readFile(filePath);
    const nftFile = new File([fileData], req.file.originalname, { type: req.file.mimetype });
    
    const metadata = {
      name,
      description,
      domain,
      properties: properties ? JSON.parse(properties) : {},
      image: '', // will be filled
      collection: collection || '',
    };

    const stored = await nftStorage.store({
      ...metadata,
      image: nftFile,
    });

    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: address,
      URI: Buffer.from(stored.url).toString('hex').toUpperCase(),
      Flags: 8,
      TransferFee: 0,
      NFTokenTaxon: 0
    };

    const payload = await xumm.payload.createAndSubscribe(
      { txjson: mintTx },
      event => event.data.signed ? event.data : undefined
    );

    await fs.unlink(filePath);

    res.json({ mintQr: payload.created.refs.qr_png, mintUuid: payload.created.uuid, metadataUrl: stored.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Minting failed.' });
  }
});

// Connect all routes
app.use('/api', apiRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error.' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
