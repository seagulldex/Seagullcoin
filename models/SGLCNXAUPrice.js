import mongoose from 'mongoose';

const SGLCNXAUPriceSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sglcn_to_xau: Number,
  xau_to_sglcn: Number
});

// For faster queries on recent data
SGLCNXAUPriceSchema.index({ timestamp: -1 });

// Optional auto-expiry after 30 days
// SGLCNXAUPriceSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model('SGLCNXAUPrice', SGLCNXAUPriceSchema);
