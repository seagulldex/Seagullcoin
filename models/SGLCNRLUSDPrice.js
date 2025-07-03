// models/SGLCNRLUSDPrice.js
import mongoose from 'mongoose';

const SGLCNRLUSDPriceSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sglcn_to_rlusd: Number,
  rlusd_to_sglcn: Number
});

SGLCNRLUSDPriceSchema.index({ timestamp: -1 });

export default mongoose.model('SGLCNRLUSDPrice', SGLCNRLUSDPriceSchema);
