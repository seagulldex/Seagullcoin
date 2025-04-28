import fs from 'fs';
import path from 'path';

const listingsFilePath = path.join(process.cwd(), 'nftListings.json');

// Load existing listings
export async function getNFTDetails(nftId) {
  try {
    if (!fs.existsSync(listingsFilePath)) return null;
    const listings = JSON.parse(fs.readFileSync(listingsFilePath, 'utf-8'));
    return listings.find(listing => listing.nftId === nftId) || null;
  } catch (error) {
    console.error('Error reading NFT listings:', error);
    return null;
  }
}

// Save a new listing
export async function saveNFTListing(newListing) {
  try {
    let listings = [];
    if (fs.existsSync(listingsFilePath)) {
      listings = JSON.parse(fs.readFileSync(listingsFilePath, 'utf-8'));
    }
    listings.push(newListing);
    fs.writeFileSync(listingsFilePath, JSON.stringify(listings, null, 2));
  } catch (error) {
    console.error('Error saving NFT listing:', error);
  }
}

// Get all listings
export async function getAllNFTListings() {
  try {
    if (!fs.existsSync(listingsFilePath)) return [];
    const listings = JSON.parse(fs.readFileSync(listingsFilePath, 'utf-8'));
    return listings;
  } catch (error) {
    console.error('Error reading all NFT listings:', error);
    return [];
  }
}

// Unlist an NFT (remove from file)
export async function unlistNFT(nftId, sellerAddress) {
  try {
    if (!fs.existsSync(listingsFilePath)) return false;
    let listings = JSON.parse(fs.readFileSync(listingsFilePath, 'utf-8'));
    const index = listings.findIndex(listing => listing.nftId === nftId && listing.sellerAddress === sellerAddress);
    if (index === -1) {
      return false;
    }
    listings.splice(index, 1); // remove listing
    fs.writeFileSync(listingsFilePath, JSON.stringify(listings, null, 2));
    return true;
  } catch (error) {
    console.error('Error unlisting NFT:', error);
    return false;
  }
}
