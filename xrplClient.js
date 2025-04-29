import xrpl from 'xrpl';

const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

// Retry logic for connecting to XRPL
async function connectWithRetry(retryAttempts = 5, delayMs = 1000) {
  let attempts = 0;
  while (attempts < retryAttempts) {
    try {
      if (!client.isConnected()) {
        await client.connect();
        isConnected = true;
        console.log("Connected to XRPL node.");

        // Monitor unexpected disconnects
        client.on('disconnected', () => {
          isConnected = false;
          console.warn("XRPL client disconnected.");
        });

        return;
      }
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} to connect failed. Retrying in ${delayMs}ms...`);
      if (attempts >= retryAttempts) {
        throw new Error('Failed to connect to XRPL after multiple attempts.');
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Ensure the client is actively connected
async function ensureConnected() {
  if (!client.isConnected()) {
    await connectWithRetry();
  } else {
    try {
      await client.request({ command: "ping" });
    } catch (e) {
      console.warn("Ping failed, reconnecting XRPL client...");
      isConnected = false;
      await connectWithRetry();
    }
  }
}

// Retrieve NFT metadata and owner info from the XRPL
export async function getNFTDetails(nftId) {
  try {
    await ensureConnected();

    const response = await client.request({
      command: "nft_info",
      nft_id: nftId,
    });

    if (response.result && response.result.nft_info) {
      const nftData = response.result.nft_info;
      const uriHex = nftData.URI || '';
      const uri = Buffer.from(uriHex, 'hex').toString('utf8');

      return {
        nftId,
        owner: nftData.Owner,
        issuer: nftData.Issuer,
        uri,
        rawURI: uriHex,
        flags: nftData.Flags,
        transferFee: nftData.TransferFee,
      };
    } else {
      console.warn('No NFT info returned for:', nftId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching NFT details:', error.message);
    return { error: true, message: error.message };
  }
}

// Gracefully disconnect the XRPL client
export async function disconnectClient() {
  if (client.isConnected()) {
    await client.disconnect();
    isConnected = false;
    console.log('Disconnected from XRPL node.');
  }
}

// Optional: auto-disconnect on server shutdown
process.on('SIGINT', disconnectClient);
process.on('SIGTERM', disconnectClient);

// Export raw client for advanced use if needed
export { client };
