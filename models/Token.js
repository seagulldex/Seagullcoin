// models/Token.js
import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner_wallet: {
    type: String,
    required: true,
    ref: 'UserWallet' // optional: for future population
  },
  max_supply: {
    type: Number,
    required: true
  },
  circulating_supply: {
    type: Number,
    default: 0
  },
  decimals: {
    type: Number,
    default: 0
  },
  isGenesisToken: {
    type: Boolean,
    default: true // the first Token created is likely the genesis token
  },
  layer: {
    type: String,
    enum: ['L1', 'L2'],
    default: 'L2' // since this is your Layer 2 system
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Token', tokenSchema);
