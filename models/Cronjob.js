import mongoose from 'mongoose';
import SGLCNXAUPrice from './models/SGLCNXAUPrice.js'; // your schema file path
import { Client } from 'xrpl';
import cron from 'node-cron';

const mongo_uri = process.env.MONGO_URI; // your Mongo URI here or env var

async function fetchAndSavePrice() {
  const client = new Client("wss://s2.ripple.com");

  try {
    await client.connect();

    const ammResponse = await client.request({
      command: "amm_info",
      asset: { currency: "XAU", issuer: "rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ" },
      asset2: { currency: "53656167756C6C436F696E000000000000000000", issuer: "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno" }
    });

    const amm = ammResponse.result.amm;
    if (!amm || !amm.amount || !amm.amount2) {
      throw new Error("AMM pool not found or invalid.");
    }

    const xau = parseFloat(amm.amount.value);
    const sglcn = parseFloat(amm.amount2.value);

    const priceDoc = new SGLCNXAUPrice({
      sglcn_to_xau: xau / sglcn,
      xau_to_sglcn: sglcn / xau,
      timestamp: new Date()
    });

    await priceDoc.save();
    console.log(`[${new Date().toISOString()}] Price saved.`);

  } catch (err) {
    console.error('Error fetching or saving price:', err.message);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}

async function startCron() {
  await mongoose.connect(mongo_uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    fetchAndSavePrice();
  });

  // Optionally, fetch on startup right away
  fetchAndSavePrice();
}

startCron();
