const express = require('express');
const bodyParser = require('body-parser');
const xrpl = require('xrpl');
const fetch = require('node-fetch');
const session = require('express-session');
const { XummSdk } = require('xumm-sdk');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(session({
  secret: 'seagullcoin-secret',
  resave: false,
  saveUninitialized: true
}));

const xrplClient = new xrpl.Client('wss://s1.ripple.com');
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

const SEAGULLCOIN_CODE = 'SGLCN-X20';
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const BURN_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';
const MINT_COST = 0.5;
const USED_PAYMENTS = new Set(); // In-memory store to avoid double-spends

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the SGLCN-X20 NFT Minting API!' });
});

// === XUMM Login ===
app.get('/login', async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' }
    });
    req.session.xummPayloadUuid = payload.uuid;
    res.json({ qr: payload.refs.qr_png, uuid: payload.uuid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create login payload' });
  }
});

app.get('/login-status/:uuid', async (req, res) => {
  try {
    const result = await xumm.payload.get(req.params.uuid);
    if (result.meta.signed) {
      req.session.walletAddress = result.response.account;
      res.json({ loggedIn: true, wallet: result.response.account });
    } else {
      res.json({ loggedIn: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error checking login status' });
  }
});

app.get('/user', (req, res) => {
  if (req.session.walletAddress) {
    res.json({ loggedIn: true, wallet: req.session.walletAddress });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// === Burn SeagullCoin ===
async function burnSeagullCoin(wallet, amount) {
  const payment = {
    TransactionType: 'Payment',
    Account: wallet,
    Destination: BURN_WALLET,
    Amount: {
      currency: SEAGULLCOIN_CODE,
      issuer: SEAGULLCOIN_ISSUER,
      value: amount.toString(),
    },
  };
  const prepared = await xrplClient.autofill(payment);
  const signed = wallet.sign(prepared);
  return await xrplClient.submit(signed.tx_blob);
}

// === Mint NFT ===
async function mintNFT(wallet, nftData) {
  const metadata = {
    name: nftData.name,
    description: nftData.description,
    image: nftData.image,
    attributes: nftData.attributes || [],
    collection: nftData.collection || null
  };

  const metadataRes = await fetch('https://api.nft.storage/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NFT_STORAGE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!metadataRes.ok) throw new Error('Failed to upload metadata');
  const metadataJson = await metadataRes.json();
  const ipfsUrl = `https://ipfs.io/ipfs/${metadataJson.value.cid}`;

  const mintTx = {
    TransactionType: 'NFTokenMint',
    Account: wallet,
    URI: xrpl.convertStringToHex(ipfsUrl),
    Flags: 0,
    TokenTaxon: 0,
    TransferFee: 0,
  };

  const preparedTx = await xrplClient.autofill(mintTx);
  const signedTx = wallet.sign(preparedTx);
  const txResult = await xrplClient.submit(signedTx.tx_blob);
  const nftTokenId = txResult.result.tx_json?.NFTokenID;

  return {
    nftTokenId,
    ipfsUrl,
    collection: nftData.collection || 'No Collection',
    mintTxHash: txResult.result.hash
  };
}

// === /mint endpoint ===
app.post('/mint', async (req, res) => {
  const { wallet, nftData } = req.body;

  if (!req.session.walletAddress || req.session.walletAddress !== wallet) {
    return res.status(401).json({ error: 'Unauthorized: Wallet mismatch or not logged in via XUMM' });
  }

  if (!wallet || !nftData) {
    return res.status(400).json({ error: 'Missing wallet or NFT data' });
  }

  try {
    await xrplClient.connect();

    const txs = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1000,
      ledger_index_max: -1,
      limit: 30
    });

    const paymentTx = txs.result.transactions.find(tx => {
      const t = tx.tx;
      return (
        tx.validated &&
        t.TransactionType === 'Payment' &&
        t.Destination === BURN_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= MINT_COST &&
        !USED_PAYMENTS.has(t.hash)
      );
    });

    if (!paymentTx) {
      return res.status(403).json({ success: false, error: 'No valid SeagullCoin payment found to burn wallet' });
    }

    USED_PAYMENTS.add(paymentTx.tx.hash); // Prevent reuse

    const mintResult = await mintNFT(wallet, nftData);
    res.status(200).json({
      success: true,
      nftTokenId: mintResult.nftTokenId,
      ipfsUrl: mintResult.ipfsUrl,
      collection: mintResult.collection,
      mintTxHash: mintResult.mintTxHash,
      paymentTxHash: paymentTx.tx.hash
    });

  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ error: 'Minting failed internally' });
  } finally {
    await xrplClient.disconnect();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`SGLCN-X20 Minting API running on port ${port}`);
});
