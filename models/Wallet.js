import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  seed: { type: String, required: true }
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', WalletSchema);
export default Wallet;
