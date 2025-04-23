const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, xrpToDrops } = require('xrpl');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://bidds.com', 'https://xrp.cafe', '*']
}));
app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const SERVICE_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const SEAGULLCOIN_CODE = '53656167756C6C436F696E000000000000000000';
const MINT_COST = '0.5';

const xrpl = new Client('wss://s1.ripple.com');
xrpl.connect();

// Payment verification endpoint
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

  try {
    const accountInfo = await xrpl.request({
      command: 'account_lines',
      account: wallet
    });

    const trustline = accountInfo.result.lines.find(
      line => line.currency === SEAGULLCOIN_CODE && line.account === SEAGULLCOIN_ISSUER
    );

    if (!trustline || parseFloat(trustline.balance) < parseFloat(MINT_COST)) {
      return res.status(402).json({ error: 'Insufficient SeagullCoin balance' });
    }

    const transactions = await xrpl.request({
      command: 'account_tx',
      account: SERVICE_WALLET,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 20
    });

    const validTx = transactions.result.transactions.find(tx =>
      tx.tx.TransactionType === 'Payment' &&
      tx.tx.Amount.currency === SEAGULLCOIN_CODE &&
      tx.tx.Amount.issuer === SEAGULLCOIN_ISSUER &&
      tx.tx.Amount.value === MINT_COST &&
      tx.tx.Account === wallet
    );

    if (!validTx) {
      return res.status(403).json({ error: 'No valid payment found' });
    }

    res.json({ success: true, txHash: validTx.tx.hash });
  } catch (e) {
    res.status(500).json({ error: 'Error verifying payment', details: e.message });
  }
});

// Mint endpoint (simplified logic for public API)
app.post('/mint', async (req, res) => {
  const { wallet, metadataUri } = req.body;
  if (!wallet || !metadataUri) return res.status(400).json({ error: 'Missing wallet or metadata URI' });

  try {
    // Example mint logic; you can expand this
    // For now, assume mint success and return a placeholder NFTokenID
    res.json({
      success: true,
      message: 'NFT minted (stub)',
      NFTokenID: '00080000F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1'
    });
  } catch (e) {
    res.status(500).json({ error: 'Minting failed', details: e.message });
  }
});

// User info endpoint (stub for now)
app.get('/user/:wallet', async (req, res) => {
  const { wallet } = req.params;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });

  try {
    // Return stub info
    res.json({
      wallet,
      trustlines: ['SeagullCoin'],
      balance: '2.5'
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user info', details: e.message });
  }
});

app.listen(port, () => {
  console.log(`SGLCN-X20 API server running on port ${port}`);
});
