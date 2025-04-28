// helpers/nftListings.js

let nftListings = [];

// Helper function to get all NFT listings
export const getAllNFTListings = () => {
  return nftListings;
};

// Helper function to unlist an NFT
export const unlistNFT = (nftId, userAddress) => {
  const index = nftListings.findIndex((listing) => listing.nftId === nftId && listing.seller === userAddress);

  if (index === -1) return { success: false, message: 'NFT not found or not owned by the user.' };

  nftListings.splice(index, 1); // Remove the NFT listing from the array
  return { success: true, message: 'NFT successfully unlisted.' };
};

// Helper function to add a new NFT listing to memory
export const addListing = (nftId, price, userAddress) => {
  if (nftListings.find(listing => listing.nftId === nftId)) {
    return { success: false, message: 'NFT is already listed.' }; // Avoid duplicate listings
  }

  nftListings.push({
    nftId,           // Unique NFT ID
    price,           // Price in SeagullCoin
    seller: userAddress,  // User wallet address of the seller
    status: 'for-sale',   // Status of the listing (could be 'for-sale', 'sold', etc.)
    createdAt: new Date(), // Timestamp when the listing was created
  });

  return { success: true, message: 'NFT successfully listed for sale.' };
};

// Get NFT details by ID
export const getNFTDetails = (nftId) => {
  const nft = nftListings.find((listing) => listing.nftId === nftId);
  if (!nft) {
    return { success: false, message: 'NFT not found.' };
  }
  return { success: true, nft };
};

// Helper function to update listing status
export const updateListingStatus = (nftId, userAddress, newStatus) => {
  const nft = nftListings.find((listing) => listing.nftId === nftId && listing.seller === userAddress);

  if (!nft) return { success: false, message: 'NFT not found or not owned by the user.' };

  nft.status = newStatus; // Update the status of the listing
  return { success: true, message: `NFT status updated to ${newStatus}.` };
};
