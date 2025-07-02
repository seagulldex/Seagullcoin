// models/SGLCNXRPPrice.js
import mongoose from 'mongoose';

const SGLCNXRPPriceSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sglcn_to_xrp: Number,
  xrp_to_sglcn: Number
});

SGLCNXRPPriceSchema.index({ timestamp: -1 });

export default mongoose.model('SGLCNXRPPrice', SGLCNXRPPriceSchema);
