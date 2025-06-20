// nftModel.js
const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema({
  wallet: String,
  NFTokenID: String,
  URI: String,
  image: String,
  name: String,
  traits: Array,
  collection: String,
  metadata: Object,
});

const NFTModel = mongoose.model('NFT', nftSchema);
module.exports = { NFTModel }; // <- Named export
