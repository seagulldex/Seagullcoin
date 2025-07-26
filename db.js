// db.ts
import mongoose from 'mongoose';
import Token from './models/Token.js';  // default import

const MONGO_URI = process.env.MONGO_URI || 'mongodb://seagullcoin-dex-uaj3x.ondigitalocean.app/gossipDB';

export async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    dbName: 'gossipDB',
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Mongoose connected');
  }
}

export async function loadGenesisToken() {
  return await Token.findOne({ isGenesisToken: true });
}
