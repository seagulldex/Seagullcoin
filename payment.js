// payment.js
import xrpl from 'xrpl';  // Import the xrpl library
import { client } from './xrplClient.js';  // Assume 'client' is properly configured for XRPL connection
import dotenv from 'dotenv';
dotenv.config();

// Define constants for SeagullCoin issuer and minting cost
const SEAGULLCOIN_ISSUER = process.env.SGLCN_ISSUER;  // SeagullCoin Issuer address
const MINTING_COST = 0.5;  // Minting cost in SeagullCoin (0.5 SGLCN)

// Check if essential environment variables are loaded
if (!SEAGULLCOIN_ISSUER) {
  throw new Error('SeagullCoin issuer (SGLCN_ISSUER) environment variable is not set.');
}

/**
 * Fetch SeagullCoin balance for the given wallet address.
 * @param {string} walletAddress - The wallet address to check for SeagullCoin balance.
 * @returns {Promise<number>} - The SeagullCoin balance of the wallet.
 */
async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await ensureConnected(); // Ensure the XRPL client is connected
    
    // Request the account_lines to get the SeagullCoin balance
    const accountInfo = await client.request({
      command: 'account_lines',
      account: walletAddress
    });

    // Find the SeagullCoin balance for the specified issuer
    const line = accountInfo.result.lines.find(line => 
      line.currency === 'SeagullCoin' && line.issuer === SEAGULLCOIN_ISSUER
    );

    // Return balance if found, otherwise return 0
    return line ? parseFloat(line.balance) : 0;
  } catch (error) {
    console.error(`Error fetching SeagullCoin balance for wallet ${walletAddress}:`, error.message);
    throw new Error(`Error fetching SeagullCoin balance for wallet ${walletAddress}`);
  }
}

/**
 * Ensure the XRPL client is connected.
 */
async function ensureConnected() {
  try {
    if (!client.isConnected()) {
      console.log('XRPL client not connected, attempting to connect...');
      await attemptConnect();
    }
  } catch (error) {
    console.error('Error connecting to XRPL client:', error.message);
    throw new Error('Connection to XRPL client failed');
  }
}

/**
 * Attempt to connect to XRPL with retries.
 * @param {number} attempts - The number of retry attempts.
 */
async function attemptConnect(attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      await client.connect();
      console.log('Connected to XRPL client successfully.');
      return;
    } catch (error) {
      if (i === attempts - 1) {
        throw new Error('Failed to connect to XRPL client after multiple attempts');
      }
      console.log(`Retrying connection to XRPL client (${i + 1}/${attempts})...`);
    }
  }
}

/**
 * Confirm that the wallet has enough SeagullCoin for minting.
 * @param {string} walletAddress - The user's wallet address to check for SeagullCoin balance.
 * @returns {Promise<object>} - Returns an object indicating success or failure.
 */
export async function confirmPayment(walletAddress) {
  try {
    // Ensure the wallet address is a string and valid
    if (typeof walletAddress !== 'string' || walletAddress.trim() === '') {
      throw new Error('Invalid wallet address provided');
    }

    // Fetch the current balance of SeagullCoin
    const balance = await fetchSeagullCoinBalance(walletAddress);

    // Check if the balance is sufficient for minting
    if (balance >= MINTING_COST) {
      console.log(`Payment of ${MINTING_COST} SeagullCoin confirmed for wallet ${walletAddress}.`);
      return { success: true, balance };
    }

    // Log insufficient balance
    console.log(`Insufficient balance. Wallet ${walletAddress} has ${balance} SeagullCoin.`);
    return { success: false, message: 'Insufficient balance' };
  } catch (error) {
    console.error('Error confirming payment for wallet:', walletAddress, error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Function to handle minting process for XUMM wallet.
 * @param {string} walletAddress - The wallet address to process the minting for.
 */
export async function processXummMinting(walletAddress) {
  try {
    // Validate the wallet address
    if (typeof walletAddress !== 'string' || walletAddress.trim() === '') {
      throw new Error('Invalid wallet address provided for minting');
    }

    // Example logic for minting
    console.log(`Processing minting for wallet: ${walletAddress}`);

    // Check if the user has enough SeagullCoin for minting before proceeding
    const paymentConfirmed = await confirmPayment(walletAddress);
    if (!paymentConfirmed.success) {
      throw new Error(`Insufficient SeagullCoin for minting. Balance: ${paymentConfirmed.balance}`);
    }

    // Your minting logic (e.g., interact with XRPL to create the NFT)
    console.log(`Minting successful for wallet: ${walletAddress}`);

  } catch (error) {
    console.error('Error during minting process for wallet:', walletAddress, error.message);
    throw new Error(`Minting failed for wallet ${walletAddress}: ${error.message}`);
  }
}
