import mongoose from "mongoose";

const BridgeRequestSchema = new mongoose.Schema({
  category: String,
  fromChain: String,
  toChain: String,
  amount: Number,
  receiveAddress: String,
  memoId: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models?.BridgeRequest || mongoose.model("BridgeRequest", BridgeRequestSchema);
