import mongoose from 'mongoose';

const BlockSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  previousHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  transactions: { type: [Object], default: [] },
  nonce: { type: Number, default: 0 },
  hash: { type: String, required: true },
});

export default mongoose.models.Block || mongoose.model('Block', BlockSchema);
