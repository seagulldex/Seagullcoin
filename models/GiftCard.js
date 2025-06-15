import mongoose from 'mongoose';

const giftCardSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  amount: { type: Number, required: true },
  code: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  usedBy: { type: String, default: null },
  usedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.models.GiftCard || mongoose.model('GiftCard', giftCardSchema);
 
