// models/Token.js
import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: String,
  owner_wallet: {
    type: String,
    required: true,
    ref: 'UserWallet'
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Token', tokenSchema);
