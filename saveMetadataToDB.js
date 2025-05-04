import axios from 'axios';

// NFT.Storage API key setup
const NFT_STORAGE_API_KEY = 'YOUR_NFT_STORAGE_API_KEY'; // Replace with your NFT.Storage API Key

// Function to save NFT metadata to NFT.Storage
export const saveMetadataToNFTStorage = async (metadata) => {
    try {
        // Prepare metadata JSON
        const nftMetadata = {
            name: metadata.name,
            description: metadata.description,
            image: metadata.ipfsUrl, // Link to IPFS URL of the NFT image
            // Add more metadata fields as necessary
        };

        // Upload metadata to NFT.Storage
        const response = await axios.post(
            'https://api.nft.storage/upload',
            nftMetadata,
            {
                headers: {
                    'Authorization': `Bearer ${NFT_STORAGE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Return the CID of the uploaded metadata
        const cid = response.data.value.cid;
        console.log('NFT metadata uploaded to IPFS:', cid);

        // Construct the IPFS URL for the uploaded metadata
        const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
        return ipfsUrl; // Return the metadata IPFS URL
    } catch (error) {
        console.error('Error uploading metadata to NFT.Storage:', error);
        throw new Error('Failed to upload metadata to NFT.Storage');
    }
};
