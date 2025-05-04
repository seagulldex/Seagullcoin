// nftminting.js
import { NFTStorage, File } from 'nft.storage';
import mime from 'mime';
import { Buffer } from 'buffer';

export async function mintNFT(walletAddress, nftData) {
  try {
    // Validate wallet address
    if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(walletAddress)) {
      return { success: false, error: 'Invalid XRPL wallet address' };
    }

    // Validate required NFT fields
    if (!nftData?.name || !nftData?.description || !nftData?.fileBase64 || !nftData?.filename) {
      return { success: false, error: 'Missing required NFT fields (name, description, file)' };
    }
    
    // Validate properties (if present)
    if (nftData.properties && typeof nftData.properties === 'object') {
      for (const [key, value] of Object.entries(nftData.properties)) {
        // Ensure the property key is a string and value is either string, number, or boolean
        if (typeof key !== 'string' || !['string', 'number', 'boolean'].includes(typeof value)) {
          return { success: false, error: `Invalid property type for ${key}. Expected string, number, or boolean, but got ${typeof value}.` };
        }
      }
    }

    // Convert base64 image to File object
    const buffer = Buffer.from(nftData.fileBase64, 'base64');
    const mimeType = mime.getType(nftData.filename) || 'application/octet-stream';
    const file = new File([buffer], nftData.filename, { type: mimeType });

    // Upload metadata to NFT.Storage
    const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
    const metadata = await client.store({
      name: nftData.name,
      description: nftData.description,
      image: file,
      properties: nftData.properties || {},
    });

    // Convert metadata URL to hex URI
    const hexUri = Buffer.from(metadata.url).toString('hex').toUpperCase();

    // Return success with URI only — the transaction was already signed earlier
    return {
      success: true,
      uri: metadata.url,
      uriHex: hexUri,
      metadata,
    };
    
    
  } catch (err) {
    console.error('Minting failed:', err);
    return { success: false, error: err.message || 'Unknown minting error' };
  }
}
