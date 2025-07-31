const bridgeHistorySchema = new mongoose.Schema({
  memoId: { type: String, required: true, unique: true },
  category: { type: String, required: true }, // SeagullCoin, etc.
  fromChain: { type: String, required: true },
  toChain: { type: String, required: true },
  receiveAddress: { type: String, required: true },

  isoMessage: { type: mongoose.Schema.Types.ObjectId, ref: "IsoMessage" },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: "AssetRegistry" },

  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
  confirmedAt: Date,
  bridgedAt: Date,
  expiresAt: Date,
  archivedAt: Date
});

eventLog: [
  {
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed
  }
]

bridgeHistorySchema.index({ memoId: 1 });
