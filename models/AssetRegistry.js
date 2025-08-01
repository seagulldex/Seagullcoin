import mongoose from 'mongoose';


const assetRegistrySchema = new mongoose.Schema({
  assetSymbol: {
    type: String,
    required: true,
    unique: true, // e.g., "SGC", "SGCASH"
  },
  assetName: {
    type: String,
    required: true, // e.g., "SeagullCoin", "SeagullCash"
  },
  iso20022Compatible: {
    type: Boolean,
    default: true
  },
  chains: [
    {
      chainName: { type: String, required: true },      // e.g., "XRP", "XDC", "XLM"
      contractAddress: { type: String },                // if applicable (e.g., on XDC)
      decimals: { type: Number, default: 18 },          // token precision
      explorerUrl: { type: String },                    // optional block explorer URL
      nativeSupport: { type: Boolean, default: false }  // true if the token is a native asset
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default assetRegistrySchema;
