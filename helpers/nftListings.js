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
