// models/UserWallet.js
import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true }, // SEAGULLXXXXXXX
  seed: { type: String, required: false }, // optional, encrypt if stored
  hashed_seed: { type: String, required: true },
  xrpl_address: { type: String, required: false }, // rXXXXXXXXX
  xumm_uuid: { type: String, required: false },

  // ✅ Token Genesis Metadata
  tokenName: { type: String, required: false },
  tokenSymbol: { type: String, required: false },
  tokenSupply: { type: Number, required: false },
  isGenesisWallet: { type: Boolean, default: false },

  // 🔁 Bridge & Interop Fields
  bridgedFromXrpl: { type: Boolean, default: false },  // For wallets created from XRPL events
  bridgeTxHash: { type: String, required: false },      // To track origin
  isCustodial: { type: Boolean, default: false },       // If owned by platform not user
  l2Balance: { type: Number, default: 0 },              // Optional tracked balance

}, { timestamps: true });

const Wallet = mongoose.model('UserWallet', WalletSchema);
export default Wallet;
