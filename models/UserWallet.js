// models/UserWallet.js
import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  seed: { type: String, required: false }, // Optional (ideally encrypted if stored)
  hashed_seed: { type: String, required: true },
  xrpl_address: { type: String, required: false },
  xumm_uuid: { type: String, required: false },

  // ✅ Token Genesis Metadata
  tokenName: { type: String, required: false },
  tokenSymbol: { type: String, required: false },
  tokenSupply: { type: Number, required: false },
  isGenesisWallet: { type: Boolean, default: false }

}, { timestamps: true });

const Wallet = mongoose.model('UserWallet', WalletSchema);
export default Wallet;
