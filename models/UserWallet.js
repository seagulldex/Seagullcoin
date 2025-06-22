import mongoose from 'mongoose';

const isValidXrplAddress = (addr) => /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(addr);

const WalletSchema = new mongoose.Schema({
  wallet: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, 
    trim: true,
    uppercase: true 
  }, // SEAGULLXXXXXXX

  seed: { type: String, required: false }, // optional, encrypt if stored
  hashed_seed: { type: String, required: true },

  xrpl_address: { 
    type: String, 
    required: true,
    index: true,
    trim: true,
    uppercase: false,
    validate: {
  validator: function(v) {
    return isValidXrplAddress(v); // no !v check here
  },
  message: props => `${props.value} is not a valid address`
}
  }, // rXXXXXXXXX

  xumm_uuid: { type: String, required: false },

  // Token Genesis Metadata
  tokenName: { type: String, required: false, trim: true },
  tokenSymbol: { type: String, required: false, trim: true, uppercase: true },
  tokenSupply: { type: Number, required: false, min: 0 },
  isGenesisWallet: { type: Boolean, default: false }, // only once!

  // Bridge & Interop Fields
  bridgedFromXrpl: { type: Boolean, default: true },
  bridgeTxHash: { type: String, trim: true, default: null },
  isCustodial: { type: Boolean, default: false },
  l2Balance: { type: Number, default: 0 }
}, { timestamps: true }); // automatically adds createdAt and updatedAt



// Compound indexes:
WalletSchema.index({ bridgedFromXrpl: 1, isCustodial: 1 });

export default mongoose.model('UserWallet', WalletSchema);
