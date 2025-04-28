// nftListings.js

// In-memory store for NFT listings (this can be an array of objects)
let nftListings = [];

// Helper function to get all NFT listings
const getAllNFTListings = () => {
  return nftListings;
};

// Helper function to unlist an NFT
const unlistNFT = (nftId, userAddress) => {
  const index = nftListings.findIndex((listing) => listing.nftId === nftId && listing.seller === userAddress);
  
  if (index === -1) return false; // NFT not found or not owned by the user
  
  nftListings.splice(index, 1); // Remove the NFT listing from the array
  return true; // Successfully unlisted
};

// Helper function to add a new NFT listing to memory
const addListing = (nftId, price, userAddress) => {
  nftListings.push({
    nftId,           // Unique NFT ID
    price,           // Price in SeagullCoin
    seller: userAddress,  // User wallet address of the seller
    status: 'for-sale',   // Status of the listing (could be 'for-sale', 'sold', etc.)
    createdAt: new Date(), // Timestamp when the listing was created
  });
};

// Exporting functions for use in other parts of the application
module.exports = {
  getAllNFTListings,
  unlistNFT,
  addListing,
};
