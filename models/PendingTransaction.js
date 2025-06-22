// models/PendingTransaction.js
import mongoose from 'mongoose';

const PendingTransactionSchema = new mongoose.Schema({
  from: { type: String },
  to: { type: String },
  amount: { type: Number },
  tokenSymbol: { type: String },
  type: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.PendingTransaction || mongoose.model('PendingTransaction', PendingTransactionSchema);
