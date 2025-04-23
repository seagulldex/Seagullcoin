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

const xrplClient = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

// Root endpoint to test server
app.get('/', (req, res) => {
  res.status(200).json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
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

// /status endpoint to show API status
app.get('/status', (req, res) => {
  res.status(200).json({
    status: "live",
    message: "Welcome to the SGLCN-X20 NFT Minting API!",
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

// /pay endpoint (check SeagullCoin payment)
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
        t.Destination === SERVICE_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= parseFloat(MINT_COST)
      );
    });

    if (!paymentTx) return res.status(403).json({ success: false, error: 'Payment not found' });

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

// /mint endpoint (mint NFTs)
app.post('/mint', async (req, res) => {
  const { wallet, uri } = req.body;
  if (!wallet || !uri) return res.status(400).json({ success: false, error: 'Missing wallet or uri' });

  try {
    await xrplClient.connect();

    const walletInstance = xrpl.Wallet.fromSeed(SERVICE_SECRET);

    const tx = {
      TransactionType: "NFTokenMint",
      Account: wallet,
      URI: Buffer.from(uri).toString('hex').toUpperCase(),
      Flags: 8,
      TransferFee: 0,
      NFTokenTaxon: 0
    };

    const prepared = await xrplClient.autofill(tx);
    const signed = walletInstance.sign(prepared);
    const result = await xrplClient.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      const tokenId = result.result.meta.nftoken_id || 'Minted';
      res.status(200).json({ success: true, tokenId });
    } else {
      res.status(400).json({ success: false, error: result.result.meta.TransactionResult });
    }
  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ success: false, error: 'Minting failed' });
  } finally {
    await xrplClient.disconnect();
  }
});

// /sell-nft endpoint (create sell offer)
app.post('/sell-nft', async (req, res) => {
  const { wallet, tokenId, amount } = req.body;
  if (!wallet || !tokenId || !amount) return res.status(400).json({ success: false, error: 'Missing wallet, tokenId, or amount' });

  try {
    await xrplClient.connect();
    const walletInstance = xrpl.Wallet.fromSeed(SERVICE_SECRET);

    const tx = {
      TransactionType: "NFTokenCreateOffer",
      Account: wallet,
      NFTokenID: tokenId,
      Amount: {
        currency: SEAGULLCOIN_CODE,
        issuer: SEAGULLCOIN_ISSUER,
        value: amount
      },
      Flags: 1 // Sell offer
    };

    const prepared = await xrplClient.autofill(tx);
    const signed = walletInstance.sign(prepared);
    const result = await xrplClient.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      res.status(200).json({ success: true, offerId: result.result.tx_json.hash });
    } else {
      res.status(400).json({ success: false, error: result.result.meta.TransactionResult });
    }
  } catch (err) {
    console.error('Sell error:', err);
    res.status(500).json({ success: false, error: 'Creating sell offer failed' });
  } finally {
    await xrplClient.disconnect();
  }
});

// /buy-nft endpoint (buy NFT)
app.post('/buy-nft', async (req, res) => {
  const { buyerWallet, sellerWallet, tokenId, amount } = req.body;
  if (!buyerWallet || !sellerWallet || !tokenId || !amount) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    await xrplClient.connect();
    const buyer = xrpl.Wallet.fromSeed(SERVICE_SECRET);

    // First send SeagullCoin payment to seller
    const paymentTx = {
      TransactionType: "Payment",
      Account: buyer.address,
      Destination: sellerWallet,
      Amount: {
        currency: SEAGULLCOIN_CODE,
        issuer: SEAGULLCOIN_ISSUER,
        value: amount
      }
    };

    const prepared = await xrplClient.autofill(paymentTx);
    const signed = buyer.sign(prepared);
    const result = await xrplClient.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult !== "tesSUCCESS") {
      return res.status(400).json({ success: false, error: 'Payment failed' });
    }

    // Then accept the NFT offer
    const acceptTx = {
      TransactionType: "NFTokenAcceptOffer",
      Account: buyer.address,
      NFTokenID: tokenId
    };

    const prepared2 = await xrplClient.autofill(acceptTx);
    const signed2 = buyer.sign(prepared2);
    const result2 = await xrplClient.submitAndWait(signed2.tx_blob);

    if (result2.result.meta.TransactionResult === "tesSUCCESS") {
      res.status(200).json({ success: true, tokenId });
    } else {
      res.status(400).json({ success: false, error: result2.result.meta.TransactionResult });
    }
  } catch (err) {
    console.error('Buy NFT error:', err);
    res.status(500).json({ success: false, error: 'Buying NFT failed' });
  } finally {
    await xrplClient.disconnect();
  }
});

app.listen(PORT, () => {
  console.log(`SGLCN-X20-API running on port ${PORT}`);
});
