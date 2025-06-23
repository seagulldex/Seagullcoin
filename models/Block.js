import mongoose from 'mongoose';

const BlockSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  previousHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  transactions: { type: [Object], default: [] },
  nonce: { type: Number, default: 0 },
  hash: { type: String, required: true },

  // ✅ These fields are correctly inside the schema
  signatures: [
    {
      validator: { type: mongoose.Schema.Types.ObjectId, ref: 'Validator' },
      signature: String
    }
  ],

  finalized: { type: Boolean, default: false }
});

// ✅ Export correctly after schema is defined
export default mongoose.models.Block || mongoose.model('Block', BlockSchema);
