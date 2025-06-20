import mongoose from 'mongoose';

const nftSchema = new mongoose.Schema({
  wallet: String,
  NFTokenID: String,
  URI: String,
  icon: String,
  collection: Object,     // flexible collection info (name, image, description, etc.)
  metadata: Object,       // full on-chain/off-chain metadata blob
  updatedAt: { type: Date, default: Date.now },
});

nftSchema.index({ wallet: 1, NFTokenID: 1 }, { unique: true });

export default mongoose.models.NFT || mongoose.model('NFT', nftSchema);
