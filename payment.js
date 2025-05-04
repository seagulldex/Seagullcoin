
import xrpl from 'xrpl';  // Import the xrpl library properly
import { xrplClient, xummApi } from './xrplClient.js';  // Ensure you have correct imports
import dotenv from 'dotenv';
dotenv.config();

/**
 * Verify the payment of SeagullCoin (SGLCN) for minting.
 * This checks if the payment has been made to the correct wallet and verifies the balance.
 * @param {string} walletAddress - The XUMM wallet address to check for SeagullCoin payment.
 * @param {number} amount - The required SeagullCoin amount for minting (0.5 in this case).
 * @returns {Promise<boolean>} - Returns true if the payment is confirmed, otherwise false.
 */
export async function confirmPayment(walletAddress, amount) {
  try {
    // Fetch the SeagullCoin balance from the wallet address
    const { balance } = await fetchSeagullCoinBalance(walletAddress);

    // Check if the balance is sufficient for the minting cost
    if (parseFloat(balance) >= amount) {
      console.log(`Payment of ${amount} SeagullCoin confirmed for wallet ${walletAddress}.`);
      return true; // Payment confirmed
    }

    console.log(`Insufficient balance. Wallet ${walletAddress} has ${balance} SeagullCoin.`);
    return false; // Insufficient balance
  } catch (error) {
    console.error('Error confirming payment:', error.message);
    return false; // Error in payment confirmation
  }
}

/**
 * Fetch SeagullCoin balance for a specific wallet address.
 * @param {string} walletAddress - The address of the XRPL wallet.
 * @returns {Promise<{balance: string}>} - The balance of SeagullCoin in the wallet.
 */
async function fetchSeagullCoinBalance(walletAddress) {
  try {
    // Make sure the XRPL client is connected and ready
    await ensureConnected();

    // Request the account lines for the wallet (check for SeagullCoin trustline)
    const accountInfo = await xrplClient.request({
      command: 'account_lines',
      account: walletAddress
    });

    // Find the SeagullCoin line
    const line = accountInfo.result.lines.find(l =>
      l.currency === 'SeagullCoin' && l.issuer === process.env.SGLCN_ISSUER
    );

    // If SeagullCoin is found in the trustline, return the balance
    return { balance: line ? line.balance : '0' };
  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error.message);
    throw error; // Propagate error for further handling
  }
}

/**
 * Ensure XRPL client is connected before making requests.
 */
async function ensureConnected() {
  try {
    if (!xrplClient.isConnected()) {
      console.log('XRPL client not connected, attempting to connect...');
      await xrplClient.connect();
    }
  } catch (error) {
    console.error('Error connecting to XRPL client:', error.message);
    throw error; // Throw error if unable to connect
  }
}

/**
 * Process the XUMM payload for minting. This would interact with the XUMM SDK.
 * @param {string} userAddress - The user's wallet address.
 * @param {number} amount - The SeagullCoin amount required.
 * @returns {Promise<void>}
 */
export async function processXummMinting(userAddress, amount) {
  try {
    // Create a XUMM payload to mint an NFT
    const payload = await xummApi.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Account: process.env.SERVICE_WALLET,  // Your service wallet (minting wallet)
        Amount: xrpl.xrpToDrops(amount),     // Convert SeagullCoin to drops (XRP units)
        Destination: userAddress,            // User's wallet address
        SendMax: xrpl.xrpToDrops(amount),   // Ensure exact amount is sent
      }
    });

    console.log('XUMM Payload created:', payload);
  } catch (error) {
    console.error('Error processing XUMM minting payload:', error.message);
  }
}
