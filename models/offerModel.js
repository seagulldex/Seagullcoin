import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  nftId: String,
  buyerAddress: String,
  price: Number,
  currency: String,
  createdAt: { type: Date, default: Date.now }
});

// Prevent "already declared" error
export const OfferModel = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
