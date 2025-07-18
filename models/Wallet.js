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
        return !v || isValidXrplAddress(v);
      },
      message: props => `${props.value} is not a valid address`
    }
  }, // rXXXXXXXXX

  xumm_uuid: { type: String, required: false },

  // Token Genesis Metadata
  tokenName: { type: String, required: false, trim: true },
  tokenSymbol: { type: String, required: false, trim: true, uppercase: true },
  tokenSupply: { type: Number, required: false, min: 0 },
  


  // Bridge & Interop Fields
  bridgedFromXrpl: { type: Boolean, default: false, index: true },  // For wallets created from XRPL events
  bridgeTxHash: { type: String, required: false, trim: true },      // To track origin
  isCustodial: { type: Boolean, default: false },                   // If owned by platform not user
  l2Balance: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Compound indexes:
WalletSchema.index({ bridgedFromXrpl: 1, isCustodial: 1 });

export default mongoose.model('UserWallet', WalletSchema);
