const BlockSchema = new mongoose.Schema({
  index: Number, // Block height
  previousHash: String,
  timestamp: Date,
  transactions: [Object], // Your transactions, e.g., { from, to, amount }
  nonce: Number,          // For PoW if you want
  hash: String            // Hash of this block's content
});
