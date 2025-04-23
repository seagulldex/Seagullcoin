const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const { NFTStorage, File } = require('nft.storage');
const { Blob } = require('buffer');
const { Xumm } = require('xumm');
const xrpl = require('xrpl');

// Load .env variables
dotenv.config();

// Load Swagger JSON
const swaggerDoc = JSON.parse(fs.readFileSync('./swagger/swagger.json', 'utf8'));

// App + Middleware
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Env Vars
const {
  NFT_STORAGE_KEY,
  XUMM_API_KEY,
  XUMM_API_SECRET,
  XRP_NETWORK_URL,
  SERVICE_WALLET,
  SGLCN_ISSUER,
  SGLCN_HEX
} = process.env;

// Initialize clients
const client = new xrpl.Client(XRP_NETWORK_URL);
const xumm = new Xumm(XUMM_API_KEY, XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: NFT_STORAGE_KEY });

(async () => {
  await client.connect();

  // /pay endpoint - XUMM payment of 0.5 SGLCN
  app.post('/pay', async (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Destination: SERVICE_WALLET,
        Amount: {
          currency: SGLCN_HEX,
          issuer: SGLCN_ISSUER,
          value: '0.5',
        },
      },
      options: { submit: true },
      user_token: true
    };

    const created = await xumm.payload.createAndSubscribe(payload, event => {
      if (event.data.signed === true) {
        return event.data;
      }
    });

    res.json({ uuid: created.created.uuid, next: created.created.next });
  });

  // /mint endpoint - Mint NFT after payment
  app.post('/mint', async (req, res) => {
    const { wallet, name, description, domain, properties, collection, fileUrl } = req.body;
    if (!wallet || !fileUrl) return res.status(400).json({ error: 'Missing fields' });

    const metadata = {
      name,
      description,
      image: fileUrl,
      properties,
      collection,
      domain
    };

    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'metadata.json');
    const cid = await nftStorage.storeDirectory([metadataFile]);
    const uri = `ipfs://${cid}/metadata.json`;

    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      URI: xrpl.convertStringToHex(uri),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0
    };

    try {
      const prepared = await client.autofill(mintTx);
      const signed = await client.submitAndWait(prepared);
      const nftId = signed.result.meta?.nftoken_id;
      res.json({ success: true, nftId });
    } catch (e) {
      res.status(500).json({ error: 'Mint failed', details: e.message });
    }
  });

  // /user endpoint - Account info
  app.get('/user/:address', async (req, res) => {
    const { address } = req.params;
    try {
      const acct = await client.request({ command: 'account_info', account: address });
      res.json(acct.result);
    } catch (e) {
      res.status(404).json({ error: 'Account not found' });
    }
  });

  // Root
  app.get('/', (req, res) => {
    res.send('SGLCN-X20 Minting API is Live');
  });

  // Launch
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, ()