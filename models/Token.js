// models/Token.js
import mongoose from 'mongoose';

console.log('Loading Token model...')
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
    required: true,
    min: 0
  },
  circulating_supply: {
    type: Number,
    default: 0,
    min: 0
  },
  decimals: {
    type: Number,
    default: 0,
    min: 0,
    max: 18
  },
  isGenesisToken: {
    type: Boolean,
    default: false
  },
  layer: {
    type: String,
    enum: ['L1', 'L2'],
    default: 'L2'
    }
  }, { timestamps: true });

// Index for common token queries per wallet
tokenSchema.index({ owner_wallet: 1, symbol: 1 });

console.log('Exporting Token model:', mongoose.models.Token ? 'Using cached model' : 'Creating new model');

export default mongoose.models.Token || mongoose.model('Token', tokenSchema);

