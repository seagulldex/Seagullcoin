// helpers/nftListings.js

let nftListings = [];

// Helper function to get all NFT listings
export const getAllNFTListings = () => {
  return nftListings;
};

// Helper function to unlist an NFT
export const unlistNFT = (nftId, userAddress) => {
  const index = nftListings.findIndex((listing) => listing.nftId === nftId && listing.seller === userAddress);

  if (index === -1) return false; // NFT not found or not owned by the user

  nftListings.splice(index, 1); // Remove the NFT listing from the array
  return true; // Successfully unlisted
};

// Helper function to add a new NFT listing to memory
export const addListing = (nftId, price, userAddress) => {
  nftListings.push({
    nftId,           // Unique NFT ID
    price,           // Price in SeagullCoin
    seller: userAddress,  // User wallet address of the seller
    status: 'for-sale',   // Status of the listing (could be 'for-sale', 'sold', etc.)
    createdAt: new Date(), // Timestamp when the listing was created
  });
};
// helpers/nftListings.js

// Get NFT details by ID
export const getNFTDetails = (nftId) => {
  return nftListings.find((listing) => listing.nftId === nftId);
};
