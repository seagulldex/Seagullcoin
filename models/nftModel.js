import mongoose from 'mongoose';

const nftSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  NFTokenID: { type: String, required: true },
  URI: String,
  image: String,
  name: String,
  traits: [{
  trait_type: String,
  value: mongoose.Schema.Types.Mixed
}],
  collection: mongoose.Schema.Types.Mixed, // ← now allows object
  icon: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

nftSchema.index({ wallet: 1, NFTokenID: 1 }, { unique: true });

export const NFTModel = mongoose.models.NFT || mongoose.model('NFT', nftSchema);
