import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  seed: { type: String, required: false },            // optional, ideally don’t save plain seed
  hashed_seed: { type: String, required: true },      // hashed seed should be required
  xrpl_address: { type: String, required: false },
  xumm_uuid: { type: String, required: false },

  // ✅ New Token Metadata Fields (move inside the schema object)
  tokenName: { type: String, required: false },
  tokenSymbol: { type: String, required: false },
  tokenSupply: { type: Number, required: false },
  isGenesisWallet: { type: Boolean, default: false },
}, { timestamps: true }); // <-- This stays outside the schema fields

const Wallet = mongoose.model('UserWallet', WalletSchema);
export default Wallet;
