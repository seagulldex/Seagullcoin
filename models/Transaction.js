import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  wallet: {
    type: String,
    required: true,
    ref: 'UserWallet'
  },
  xrpl_address: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['TRANSFER', 'MINT', 'BURN', 'STAKE', 'NFT_TRANSFER', 'L2_TX'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  txHash: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed // For custom data like NFT ID, token ID etc.
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Transaction', transactionSchema);
