// payment.js
import xrpl from 'xrpl';  // Import the xrpl library
import { client } from './xrplClient.js';  // Assume 'client' is properly configured for XRPL connection
import dotenv from 'dotenv';
dotenv.config();

// Define constants for SeagullCoin issuer and minting cost
const SEAGULLCOIN_ISSUER = process.env.SGLCN_ISSUER;  // SeagullCoin Issuer address
const MINTING_COST = 0.5;  // Minting cost in SeagullCoin (0.5 SGLCN)

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
    console.error('Error fetching SeagullCoin balance:', error.message);
    throw new Error('Error fetching SeagullCoin balance');
  }
}

/**
 * Ensure the XRPL client is connected.
 */
async function ensureConnected() {
  try {
    if (!client.isConnected()) {
      console.log('XRPL client not connected, attempting to connect...');
      await client.connect();
    }
  } catch (error) {
    console.error('Error connecting to XRPL client:', error.message);
    throw new Error('Connection failed');
  }
}

/**
 * Confirm that the wallet has enough SeagullCoin for minting.
 * @param {string} walletAddress - The user's wallet address to check for SeagullCoin balance.
 * @returns {Promise<object>} - Returns an object indicating success or failure.
 */
export async function confirmPayment(walletAddress) {
  try {
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
    console.error('Error confirming payment:', error.message);
    return { success: false, message: error.message };
  }
}
// payment.js

/**
 * Function to handle minting process for XUMM wallet.
 * @param {string} walletAddress - The wallet address to process the minting for.
 */
export async function processXummMinting(walletAddress) {
  try {
    // Example logic for minting
    console.log(`Processing minting for wallet: ${walletAddress}`);
    // Your minting logic (e.g., validate payment, interact with XRPL, etc.)
  } catch (error) {
    console.error('Error during minting process:', error.message);
    throw error; // Optionally, rethrow if you want to handle it further upstream
  }
}
