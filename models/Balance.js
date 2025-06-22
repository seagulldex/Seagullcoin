import mongoose from 'mongoose';

const BalanceSchema = new mongoose.Schema({
  address: { type: String, unique: true },
  amount: { type: Number, default: 0 },
});

export default mongoose.model('Balance', BalanceSchema);
