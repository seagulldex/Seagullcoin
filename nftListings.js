// nftListings.js

let nftListings = []; // In-memory placeholder, consider replacing with a DB in production

export function addListing(nftId, price, seller, currency) {
  nftListings.push({ nftId, price, seller, currency, timestamp: Date.now() });
  return true;
}

export function getNFTDetails(nftId) {
  return nftListings.find(item => item.nftId === nftId);
}

export function unlistNFT(nftId, requester) {
  const index = nftListings.findIndex(item => item.nftId === nftId && item.seller === requester);
  if (index !== -1) {
    nftListings.splice(index, 1);
    return true;
  }
  return false;
}

export function getAllNFTListings() {
  return nftListings;
}
