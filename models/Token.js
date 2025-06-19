// models/Token.js
import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  owner_wallet: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'UserWallet',
  required: true
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
    default: false
  },
  layer: {
    type: String,
    enum: ['L1', 'L2'],
    default: 'L2'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Token', tokenSchema);
