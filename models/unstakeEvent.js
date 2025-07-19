// unstakeEvent.model.js (or .mjs if not using "type": "module")
import mongoose from 'mongoose';

const unstakeEventSchema = new mongoose.Schema({
  unstakeId: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true },
  stakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stake', required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  estimatedReward: { type: Number, required: true },
  totalExpected: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  unlockDate: { type: Date, required: true },
  payoutScheduledAt: { type: Date, required: true },
  status: { type: String, default: 'processing' }
});

const UnstakeEvent = mongoose.model('UnstakeEvent', unstakeEventSchema);

export default UnstakeEvent;
