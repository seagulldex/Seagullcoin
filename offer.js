// routes/offer.js
const express = require('express');
const xrpl = require('xrpl');
const { getWalletFromSession } = require('../utils/sessionUtils');
const { xumm } = require('../utils/xummUtils'); // XUMM SDK instance
const { SEAGULLCOIN_ISSUER, SEAGULLCOIN_CURRENCY_HEX } = require('../config/constants');

const router = express.Router();

// Create Offer (sell NFT for SeagullCoin)
router.post('/create', async (req, res) => {
  const { nftokenId, amount } = req.body;
  const userAddress = getWalletFromSession(req);

  if (!userAddress || !nftokenId || !amount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const payload = {
      TransactionType: 'NFTokenCreateOffer',
      Account: userAddress,
      NFTokenID: nftokenId,
      Amount: {
        currency: SEAGULLCOIN_CURRENCY_HEX,
        issuer: SEAGULLCOIN_ISSUER,
        value: amount.toString()
      },
      Flags: 1, // Sell offer
    };

    const { created } = await xumm.payload.createAndSubscribe(payload, event => {
      if (event.data.signed === true) {
        return event.data;
      }
    });

    res.json({ success: true, next: created.next.always });
  } catch (error) {
    console.error('Create Offer Error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// Accept Offer
router.post('/accept', async (req, res) => {
  const { offerId } = req.body;
  const userAddress = getWalletFromSession(req);

  if (!userAddress || !offerId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const payload = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: userAddress,
      NFTokenSellOffer: offerId,
    };

    const { created } = await xumm.payload.createAndSubscribe(payload, event => {
      if (event.data.signed === true) {
        return event.data;
      }
    });

    res.json({ success: true, next: created.next.always });
  } catch (error) {
    console.error('Accept Offer Error:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// Cancel Offer
router.post('/cancel', async (req, res) => {
  const { offerId } = req.body;
  const userAddress = getWalletFromSession(req);

  if (!userAddress || !offerId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const payload = {
      TransactionType: 'NFTokenCancelOffer',
      Account: userAddress,
      NFTokenOffers: [offerId],
    };

    const { created } = await xumm.payload.createAndSubscribe(payload, event => {
      if (event.data.signed === true) {
        return event.data;
      }
    });

    res.json({ success: true, next: created.next.always });
  } catch (error) {
    console.error('Cancel Offer Error:', error);
    res.status(500).json({ error: 'Failed to cancel offer' });
  }
});

module.exports = router;
