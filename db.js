// db.ts
import mongoose from 'mongoose';
import Token from './models/Token.js';  // default import

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gossipDB';

export async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Mongoose connected');
  }
}

export async function loadGenesisToken() {
  const token = await Token.findOne({ isGenesisToken: true });
  return token;
}
