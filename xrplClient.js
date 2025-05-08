import xrpl from 'xrpl';
import { XummSdk } from 'xumm-sdk';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// XRPL Client setup
const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

// XUMM SDK instance
const xummApi = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

// Export the instances for use elsewhere
export { client, xummApi };

/** XRPL disconnect handler */
client.on('disconnected', () => {
  isConnected = false;
  console.warn("XRPL client disconnected.");
});

/**
 * Ensure XRPL client is connected and responsive.
 * @param {number} retryAttempts Number of retries.
 * @param {number} delayMs Delay between retries in ms.
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
 * Fetch SeagullCoin balance from trustline.
 * @param {string} walletAddress
 * @returns {Promise<{balance: string}>}
 */
export async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await ensureConnected();

    const request = {
      method: 'account_lines',
      params: [
        {
          account: walletAddress,
          api_version: 2
        }
      ]
    };

    console.log('Fetching SeagullCoin balance:', request);

    const accountInfo = await client.request(request);  // Corrected with params and api_version
    const line = accountInfo.result.lines.find(l =>
      l.currency === 'SeagullCoin' && l.issuer === process.env.SGLCN_ISSUER
    );

    // Return the balance or '0' if no balance found
    return { balance: line?.balance || '0' };
  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error?.data ?? error);
    return { error: true, message: error.message || 'Unknown error' };
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
 * Decode URI and return basic info from an NFT object.
 * @param {object} nft - NFT object from account_nfts
 */
export function decodeNFTBasicInfo(nft) {
  const uri = nft.URI ? Buffer.from(nft.URI, 'hex').toString('utf8') : '';
  return {
    nftId: nft.NFTokenID,
    issuer: nft.Issuer,
    uri,
    rawURI: nft.URI,
    flags: nft.Flags,
    transferFee: nft.TransferFee,
  };
}

/**
 * Fetch metadata from the URI (usually an IPFS link).
 * @param {string} uri - The URI in hex format.
 * @returns {Promise<object|null>} - Decoded JSON metadata or null if error.
 */
export async function fetchNFTMetadata(uri) {
  try {
    const decodedURI = Buffer.from(uri, 'hex').toString('utf8');
    const response = await axios.get(decodedURI);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching NFT metadata from URI:', error.message);
    return null;
  }
}

/**
 * Fetch active offers for an NFT.
 * @param {string} nftId
 * @returns {Promise<object[]>}
 */
export async function getNFTokenOffers(nftId) {
  try {
    await ensureConnected();
    const offers = await client.request({
      command: "nft_sell_offers",
      nft_id: nftId
    });
    return offers.result.offers || [];
  } catch (e) {
    console.error("Error fetching NFT offers:", e.message);
    return [];
  }
}

/**
 * Filter NFTs by SeagullCoin issuer.
 * @param {object[]} nfts - List of NFTs to filter.
 * @returns {object[]} - Filtered NFTs that are issued by SeagullCoin.
 */
export function filterNFTsBySeagullCoinIssuer(nfts) {
  return nfts.filter(nft => nft.Issuer === process.env.SGLCN_ISSUER);
}

/** Gracefully disconnect XRPL client */
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

// Cleanup handlers
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

setInterval(async () => {
  if (client.isConnected()) {
    try {
      await client.request({ command: "ping" });
    } catch {
      console.warn("Ping failed, reconnecting...");
      await connectWithRetry();
    }
  }
}, 60000); // every 60 seconds
