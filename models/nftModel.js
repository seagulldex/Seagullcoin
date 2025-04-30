import mongoose from 'mongoose';

// Define your NFT schema
const nftSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  nftokenId: { type: String, required: true, unique: true },
  owner: { type: String, required: true },  // The owner could be the wallet address
  imageUrl: { type: String, required: true },  // Store file URL or path
  properties: mongoose.Schema.Types.Mixed,  // Store any additional properties
  createdAt: { type: Date, default: Date.now },
});

// Create a model using the schema
const NFTModel = mongoose.model('NFT', nftSchema);

// Export the model
export { NFTModel };
