import mongoose from 'mongoose';

const PriceHistorySchema = new mongoose.Schema({
  pair: { type: String, required: true }, // e.g. 'SGLCN/XAU'
  sglcn_to_xau: Number,
  xau_to_sglcn: Number,
  timestamp: { type: Date, default: Date.now }
});

// Avoid recompiling model in dev environments
export const PriceHistory = mongoose.models.PriceHistory || mongoose.model('PriceHistory', PriceHistorySchema);
