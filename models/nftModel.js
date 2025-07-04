import mongoose from 'mongoose';

const nftSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  NFTokenID: { type: String, required: true },
  URI: String,
  image: String,
  name: String,
  traits: Array,
  collection: String,
  icon: String,
  metadata: Object,
  }, { timestamps: true });

nftSchema.index({ wallet: 1, NFTokenID: 1 }, { unique: true });

export const NFTModel = mongoose.models.NFT || mongoose.model('NFT', nftSchema);
