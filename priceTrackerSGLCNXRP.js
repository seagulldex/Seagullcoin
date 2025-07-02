// priceTrackerSGLCNXRP.js
import mongoose from 'mongoose';
import { Client } from 'xrpl';
import SGLCNXRPPrice from './models/SGLCNXRPPrice.js';

const MONGO_URI = process.env.MONGO_URI;

async function fetchAndSaveXRPPrice() {
  const client = new Client('wss://s2.ripple.com');

  try {
    await client.connect();

    const ammResponse = await client.request({
      command: 'amm_info',
      asset: { currency: 'XRP' },
      asset2: {
        currency: '53656167756C6C436F696E000000000000000000',
        issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'
      }
    });

    const amm = ammResponse.result.amm;
    if (!amm || !amm.amount || !amm.amount2) return;

    const { amount, amount2 } = amm;

    let xrp, sglcn;

    if (amount.currency === undefined) {
      xrp = parseFloat(amount.value) / 1_000_000;
      sglcn = parseFloat(amount2.value);
    } else if (amount2.currency === undefined) {
      sglcn = parseFloat(amount.value);
      xrp = parseFloat(amount2.value) / 1_000_000;
    } else {
      console.warn('AMM does not include XRP:', { amount, amount2 });
      return;
    }

    if (isNaN(xrp) || isNaN(sglcn) || xrp === 0 || sglcn === 0) {
      console.warn('Invalid parsed values:', { xrp, sglcn });
      return;
    }

    const entry = new SGLCNXRPPrice({
      sglcn_to_xrp: xrp / sglcn,
      xrp_to_sglcn: sglcn / xrp
    });

    await entry.save();
    console.log(`[${new Date().toISOString()}] XRP price saved.`);
  } catch (err) {
    console.error('XRP Fetch/Save Error:', err.message);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}


// Connect to DB and schedule
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected for XRP↔SGLCN');

  setInterval(fetchAndSaveXRPPrice, 5 * 60 * 1000);
  fetchAndSaveXRPPrice(); // Optional immediate run
});
