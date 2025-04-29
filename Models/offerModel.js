const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, index: true },
  owner: { type: String, required: true, index: true },
  amount: { type: String, required: true },
  destination: { type: String }, // optional buyer destination
  offerId: { type: String, required: true, unique: true }, // XRPL Offer ID
  type: { type: String, enum: ['buy', 'sell'], required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Offer', offerSchema);
