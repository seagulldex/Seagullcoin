import mongoose from 'mongoose';

const isValidXrplAddress = (addr) => /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(addr);

const WalletSchema = new mongoose.Schema({
  wallet: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, 
    trim: true,
    uppercase: true,
    match: /^SEAGULL[A-Z0-9]{6,}$/ // Enforce SEAGULLXXX format
  }

  encrypted_seed: { type: String, required: false },  // <-- encrypted seed here
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

    // ✅ Add here
  hasMinted: { type: Boolean, default: false },

  
  // Bridge & Interop Fields
  bridgedFromXrpl: { type: Boolean, default: true },
  bridgeTxHash: { type: String, trim: true, default: null },
  isCustodial: { type: Boolean, default: false },
  
balance: { type: Number, default: 0 }, // ✅ Changed from l2Balance
  nonce: { type: Number, default: 0 },   // optional anti-replay
}, { timestamps: true });

// Add method to decrypt seed (import decrypt function from utils/encryption.js)
WalletSchema.methods.getDecryptedSeed = function() {
  if (!this.encrypted_seed) return null;
  // import decrypt function at top of this file if needed
  return decrypt(this.encrypted_seed);
};

// Compound indexes:
WalletSchema.index({ bridgedFromXrpl: 1, isCustodial: 1 });

export default mongoose.model('UserWallet', WalletSchema);
