import mongoose from 'mongoose';
import Token from './models/Token.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://seagullcoin-dex-uaj3x.ondigitalocean.app/gossipDB';

export async function connectDB() {
  if (mongoose.connection.readyState !== 1) {
    console.log(`ℹ️ Mongoose state: ${mongoose.connection.readyState} — connecting...`);
    await mongoose.connect(MONGO_URI, {
      dbName: 'gossipDB',
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Mongoose connected');
  } else {
    console.log('✅ Mongoose already connected');
  }
}


export async function loadGenesisToken() {
  return await Token.findOne({ isGenesisToken: true });
}
