import xrpl from 'xrpl';

const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

// Retry logic for connection attempts
async function connectWithRetry(retryAttempts = 5, delayMs = 1000) {
  let attempts = 0;
  while (attempts < retryAttempts) {
    try {
      if (!client.isConnected()) {
        await client.connect();
        isConnected = true;
        console.log("Connected to XRPL node.");
        return;
      }
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} to connect failed. Retrying in ${delayMs}ms...`);
      if (attempts >= retryAttempts) {
        throw new Error('Failed to connect after multiple attempts.');
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Ensures the client is connected before making a request
async function ensureConnected() {
  if (!isConnected) {
    await connectWithRetry();
  }
}

// Function to retrieve NFT details
export async function getNFTDetails(nftId) {
  try {
    await ensureConnected();

    const response = await client.request({
      command: "nft_info",
      nft_id: nftId,
    });

    if (response.result && response.result.nft_info) {
      const nftData = response.result.nft_info;
      return {
        nftId: nftId,
        owner: nftData.Owner,
        uri: nftData.URI,
        flags: nftData.Flags,
        transferFee: nftData.TransferFee,
        issuer: nftData.Issuer,
      };
    } else {
      console.error('No NFT info found for', nftId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching NFT details from XRPL:', error);
    return null;
  }
}

// Close the client gracefully when no longer needed
export async function disconnectClient() {
  if (client.isConnected()) {
    await client.disconnect();
    isConnected = false;
    console.log('Disconnected from XRPL node.');
  }
}

// Export client for direct access if needed
export { client };
