// nftListings.js
import { NFTModel } from './models/nftModel.js';
import { OfferModel } from './models/offerModel.js';

/**
 * Add a new listing for an NFT
 */
export async function addListing(nftId, price, currency, seller) {
  const offer = new OfferModel({
    nftId,
    price,
    currency,
    seller,
    createdAt: new Date()
  });

  await offer.save();
  return offer;
}

/**
 * Get NFT details by ID
 */
export async function getNFTDetails(nftId) {
  return await NFTModel.findOne({ nftId });
}

/**
 * Remove a listing (unlist an NFT)
 */
export async function unlistNFT(nftId) {
  return await OfferModel.deleteOne({ nftId });
}

/**
 * Get all active NFT listings
 */
export async function getAllNFTListings() {
  return await OfferModel.find({}); // You can add filters like { active: true } if needed
}
