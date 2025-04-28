import xrpl from 'xrpl';

const client = new xrpl.Client('wss://s.altnet.rippletest.net:51234/'); // Testnet URL

// Connect to the XRPL client
async function connectClient() {
  if (!client.isConnected()) {
    await client.connect();
  }
  return client;
}

// Function to get NFTs associated with a wallet address
export const getNFTData = async (walletAddress) => {
  try {
    const clientInstance = await connectClient();

    // Send the account_nfts request to get NFTs owned by the wallet
    const request = {
      command: 'account_nfts',
      account: walletAddress,  // Wallet address to check for NFTs
    };

    const response = await clientInstance.request(request);

    // Check for NFTs in the response
    if (response.result && response.result.nfts) {
      return response.result.nfts; // Return NFTs if found
    } else {
      return []; // No NFTs found
    }
  } catch (err) {
    console.error("Error fetching NFTs:", err);
    throw new Error('Failed to fetch NFT data');
  }
};

// Function to get the ownership status of an NFT by its ID
export const checkNFTOwnership = async (nftId, walletAddress) => {
  try {
    const nfts = await getNFTData(walletAddress);

    // Check if the provided nftId exists in the wallet's NFTs
    const nft = nfts.find(nft => nft.nft_id === nftId);

    if (nft) {
      return nft.owner === walletAddress; // Return true if the wallet owns the NFT
    } else {
      return false; // NFT not found in the wallet
    }
  } catch (err) {
    console.error("Error checking NFT ownership:", err);
    throw new Error('Failed to check NFT ownership');
  }
};

// Export the client connection for other modules to use
export default connectClient;
