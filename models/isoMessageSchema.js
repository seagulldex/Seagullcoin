const isoMessageSchema = new mongoose.Schema({
  chain: {
    type: String,
    required: true,
    enum: ["XRP", "XDC", "XLM", "ETH", "Other"]
  },
  asset: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "AssetRegistry",
  required: true
},
  messageType: {
    type: String,
    required: true // e.g., pacs.008, camt.053
  },
  sender: {
    name: String,
    partyId: String
  },
  receiver: {
    name: String,
    partyId: String
  },
  amount: {
    value: Number,
    currency: String
  },
  timestamp: {
    type: Date,
    required: true
  },
  rawXml: {
    type: String
  },
  parsedJson: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
