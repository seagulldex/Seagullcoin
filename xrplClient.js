import xrpl from 'xrpl';

const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

// Setup the disconnect handler once
client.on('disconnected', () => {
  isConnected = false;
  console.warn("XRPL client disconnected.");
});

// Retry logic for connecting to XRPL
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

// Fetch NFTs for a given address
export async function fetchNFTs(address) {
  try {
    await ensureConnected();
    const response = await client.request({
      command: "account_nfts",
      account: address,
    });
    return response.result.nfts || [];
  } catch (error) {
    console.error('Error fetching NFTs:', error.message);
    return { error: true, message: error.message };
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
  try {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('Disconnected from XRPL node.');
    }
  } catch (err) {
    console.warn('Error during disconnect:', err.message);
  } finally {
    isConnected = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await disconnectClient();
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', async () => {
  await disconnectClient();
  setTimeout(() => process.exit(0), 500);
});

// Catch unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

// Export raw client if needed
export { client };

export async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await ensureConnected(); // Ensures the client is connected before making the request

    const accountInfo = await client.request({
      command: 'account_lines',
      account: walletAddress
    });

    const balance = accountInfo.result.lines.find(line =>
      line.currency === 'SeagullCoin' &&
      line.issuer === process.env.SGLCN_ISSUER
    )?.balance || '0';

    return { balance };
  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error);
    throw error;
  }
}
