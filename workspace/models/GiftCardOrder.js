// models/GiftCardOrder.js
import mongoose from 'mongoose';

const giftCardOrderSchema = new mongoose.Schema({
  identifier: String,
  brand: String,
  amount: Number,
  wallet: String,
  recipientEmail: String,
  priceSGLCN: Number,
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  fulfilledAt: Date
});

const GiftCardOrder = mongoose.models.GiftCardOrder || mongoose.model('GiftCardOrder', giftCardOrderSchema);
export default GiftCardOrder;
