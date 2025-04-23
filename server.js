const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const xrpl = require('xrpl');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SERVICE_SECRET = process.env.SERVICE_SECRET;
const SEAGULLCOIN_CODE = "SeagullCoin";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_COST = "0.5";
const BURN_WALLET = "r9ByKdPsDznUPPEsmLKvjPdS5qfBSWHEBL"; // hardcoded burn wallet

const xrplClient = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
    endpoints: ["/pay", "/mint", "/collections", "/user/:address", "/buy-nft", "/sell-nft", "/burn"]
  });
});

app.get('/status', (req, res) => {
  res.status(200).json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
    endpoints: ["/pay", "/mint", "/collections", "/user/:address", "/buy-nft", "/sell-nft", "/burn"]
  });
});

// PAY endpoint — now checks BURN_WALLET
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ success: false, error: 'Missing wallet address' });

  try {
    await xrplClient.connect();

    const transactions = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 20,
    });

    const paymentTx = transactions.result.transactions.find(tx => {
      const t = tx.tx;
      return (
        t.TransactionType === 'Payment' &&
        t.Destination === BURN_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= parseFloat(MINT_COST)
      );
    });

    if (!paymentTx) return res.status(403).json({ success: false, error: 'Payment not found to burn wallet' });

    res.status(200).json({
      success: true,
      txHash: paymentTx.tx.hash,
    });

  } catch (err) {
    console.error('Payment check error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    await xrplClient.disconnect();
  }
});

// Remaining endpoints stay unchanged — using SERVICE_SECRET to mint or transact
// ... (mint, sell-nft, buy-nft, burn) — already correct

app.listen(PORT, () => {
  console.log(`SGLCN-X20-API running on port ${PORT}`);
});
