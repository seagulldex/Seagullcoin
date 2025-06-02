// test-mongo.js
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://allowedseagull:NFTSeagull@cluster1.e6rsvij.mongodb.net/nft_marketplace_nfts?retryWrites=true&w=majority&appName=Cluster1";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB connection successful!");
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  } finally {
    await client.close();
  }
}

run();
