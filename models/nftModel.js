import mongoose from 'mongoose';

const nftSchema = new mongoose.Schema({
  wallet: String,
  NFTokenID: String,
  URI: String,
  image: String,
  name: String,
  traits: Array,
  collection: String,
  icon: String,
  metadata: Object,
  updatedAt: { type: Date, default: Date.now },
});

nftSchema.index({ wallet: 1, NFTokenID: 1 }, { unique: true });

export const NFTModel = mongoose.models.NFT || mongoose.model('NFT', nftSchema);
