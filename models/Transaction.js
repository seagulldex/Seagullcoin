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
    enum: [
      'TRANSFER', 'WALLET_CREATION', 'MINT', 'BURN', 'STAKE',
      'NFT_TRANSFER', 'L2_TX', 'NFT_SALE', 'ACCEPT_OFFER', 'CREATE_OFFER',
      'BRIDGE_IN', 'BRIDGE_OUT', 'XRPL_PAYMENT'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be non-negative'],
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

  // ✅ XRPL ↔ Layer 2 bridge tracking
  layer: {
    type: String,
    enum: ['L1', 'L2'],
    default: 'L2'
  },
  bridged: {
    type: Boolean,
    default: false
  },
  bridgeDirection: {
    type: String,
    enum: ['IN', 'OUT'],
    required: false
  },

    // ✅ Token/fee specific
  fee: {
    type: Number,
    default: 0
  },
  tokenHex: {
    type: String,
    required: false
  },
  currencyCode: {
    type: String,
    required: true
  },
  issuer: {
    type: String,
    required: true
  },

  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Transaction', transactionSchema);

console.log("Transaction model initialized:", mongoose.modelNames());
