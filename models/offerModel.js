import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  nftId: String,
  buyerAddress: String,
  price: Number,
  currency: String,
  createdAt: { type: Date, default: Date.now }
});

export const OfferModel = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
