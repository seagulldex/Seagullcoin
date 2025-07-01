import mongoose from 'mongoose';

const SGLCNXAUPriceSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sglcn_to_xau: Number,
  xau_to_sglcn: Number
});

export default mongoose.model('SGLCNXAUPrice', SGLCNXAUPriceSchema);
