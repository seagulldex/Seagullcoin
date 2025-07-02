import mongoose from 'mongoose';
import { Client } from 'xrpl';
import SGLCNXAUPrice from './models/SGLCNXAUPrice.js'; // your schema file

const MONGO_URI = process.env.MONGO_URI;

async function fetchAndSavePrice() {
  const client = new Client('wss://s2.ripple.com');
  try {
    await client.connect();

    const ammResponse = await client.request({
      command: 'amm_info',
      asset: { currency: 'XAU', issuer: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ' },
      asset2: { currency: '53656167756C6C436F696E000000000000000000', issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno' }
    });

    const amm = ammResponse.result.amm;
    if (!amm || !amm.amount || !amm.amount2) return;

    const xau = parseFloat(amm.amount.value);
    const sglcn = parseFloat(amm.amount2.value);

    const entry = new SGLCNXAUPrice({
      sglcn_to_xau: xau / sglcn,
      xau_to_sglcn: sglcn / xau,
    });

    await entry.save();
    console.log(`[${new Date().toISOString()}] Price saved.`);
  } catch (err) {
    console.error('Fetch/Save Error:', err.message);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}

// Start it up
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');

  // Run every 5 minutes (300,000 ms)
  setInterval(fetchAndSavePrice, 5 * 60 * 1000);

  // Optionally, run immediately on startup
  fetchAndSavePrice();
});
