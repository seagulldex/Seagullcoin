import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  seed: { type: String, required: false },            // optional, ideally don’t save plain seed
  hashed_seed: { type: String, required: true },      // hashed seed should be required
  xrpl_address: { type: String, required: false },
  xumm_uuid: { type: String, required: false },
}, { timestamps: true });

const Wallet = mongoose.model('UserWallet', WalletSchema);
export default Wallet;
console.log("Wallet model initialized as:", mongoose.modelNames());
