import xrpl from 'xrpl';
import XummSdk from 'xumm-sdk';
import dotenv from 'dotenv';
dotenv.config();

const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

const xummApi = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
export { xummApi, client };

// XRPL disconnect handler
client.on('disconnected', () => {
  isConnected = false;
  console.warn("XRPL client disconnected.");
});

/**
 * Connect to XRPL with retry logic.
 * @param {number} retryAttempts
 * @param {number} delayMs
 */
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
      console.error(`Attempt ${attempts} failed. Retrying in ${delayMs}ms...`);
      if (attempts >= retryAttempts) throw new Error('Failed to connect to XRPL after multiple attempts.');
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

/** Ensure XRPL client is connected and responsive. */
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

/**
 * Fetch NFTs held by an XRPL account.
 * @param {string} address - XRPL account address.
 * @returns {Promise<object[]>}
 */
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

/**
 * Fetch full details about a single NFT by its ID.
 * @param {string} nftId - NFT ID (hex).
 * @returns {Promise<object|null>}
 */
export async function getNFTDetails(nftId) {
  try {
    await ensureConnected();
    const response = await client.request({
      command: "nft_info",
      nft_id: nftId,
    });

    if (response.result?.nft_info) {
      const info = response.result.nft_info;
      const uri = Buffer.from(info.URI || '', 'hex').toString('utf8');

      return {
        nftId,
        owner: info.Owner,
        issuer: info.Issuer,
        uri,
        rawURI: info.URI,
        flags: info.Flags,
        transferFee: info.TransferFee,
      };
    }

    console.warn('No NFT info returned for:', nftId);
    return null;
  } catch (error) {
    console.error('Error fetching NFT details:', error.message);
    return { error: true, message: error.message };
  }
}

/**
 * Get SeagullCoin balance from a trustline.
 * @param {string} walletAddress
 * @returns {Promise<{balance: string}>}
 */
export async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await ensureConnected();

    const accountInfo = await client.request({
      command: 'account_lines',
      account: walletAddress
    });

    const line = accountInfo.result.lines.find(l =>
      l.currency === 'SeagullCoin' &&
      l.issuer === process.env.SGLCN_ISSUER
    );

    return { balance: line?.balance || '0' };
  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error.message);
    throw error;
  }
}

/** Disconnect XRPL client gracefully. */
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

// Handle process shutdown and uncaught errors
process.on('SIGINT', async () => {
  await disconnectClient();
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', async () => {
  await disconnectClient();
  setTimeout(() => process.exit(0), 500);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
