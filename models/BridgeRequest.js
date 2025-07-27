import mongoose from "mongoose";

const BridgeRequestSchema = new mongoose.Schema({
  category: String,              // SeagullCash or SeagullCoin
  fromChain: String,             // e.g. XLM
  toChain: String,               // e.g. XRP
  amount: Number,
  receiveAddress: String,        // 🔧 Add this
  memoId: String,                // 🔧 Add this
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.BridgeRequest || mongoose.model("BridgeRequest", BridgeRequestSchema);
