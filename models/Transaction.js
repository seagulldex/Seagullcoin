import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  wallet: {
    type: String,
    required: true,
    ref: 'UserWallet' // Optional: only helpful if you want to `populate` related wallet info
  },
  xrpl_address: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['TRANSFER','WALLET_CREATION', 'MINT', 'BURN', 'STAKE', 'NFT_TRANSFER', 'L2_TX', 'NFT_SALE', 'ACCEPT_OFFER', 'CREATE_OFFER'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be non-negative'], // validation for non-negative
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
    type: mongoose.Schema.Types.Mixed, // You can store additional data here
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Transaction', transactionSchema);
console.log("Wallet model initialized as:", mongoose.modelNames());
