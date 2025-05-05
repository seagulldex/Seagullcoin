import { xummApi } from './xrplClient.js'; // Assuming xummApi is already configured
import dotenv from 'dotenv';
dotenv.config();
import { db } from './dbsetup.js'; // Assumes you created and exported db from db.js or server.js


const payloadUUID = 'your-payload-uuid'; // The UUID from the XUMM payload
const expectedSigner = 'user-wallet-address'; // The wallet address of the user making the payment
const usedPayloads = new Set();

const SERVICE_WALLET = process.env.SERVICE_WALLET;  // Minting wallet (Service Wallet)
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;     // SeagullCoin issuer address
const SGLCN_CODE = '53656167756C6C436F696E000000000000000000'; // Hex for SeagullCoin


/**
 * Validate the SeagullCoin payment details
 * @param {object} tx - The transaction object
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
async function validateSeagullCoinPayment(tx) {
  const amount = tx.Amount;
  console.log('Payment amount:', amount);

  // Validate the currency is SeagullCoin and the amount is correct (0.5 SGLCN)
  if (typeof amount !== 'object' || amount.currency !== SGLCN_CODE || amount.issuer !== SGLCN_ISSUER) {
    console.log('Payment must be SeagullCoin (X20)');
    return { success: false, reason: 'Payment must be SeagullCoin (X20)' };
  }

  // Ensure that the amount is exactly 0.5
  if (parseFloat(amount.value) !== 0.5) {
    console.log('Incorrect SeagullCoin amount');
    return { success: false, reason: 'Incorrect SeagullCoin amount' };
  }

  return { success: true };
}

/**
 * Confirm the XUMM payment was signed and meets all SeagullCoin minting criteria.
 * @param {string} payloadUUID - The XUMM payload UUID from the client.
 * @param {string} expectedSigner - The wallet address of the user (the expected signer).
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function confirmPayment(payloadUUID, expectedSigner) {
  // Check if payloadUUID is provided
  if (!payloadUUID) {
    console.error('Error: payloadUUID is missing');
    return { success: false, reason: 'Payload UUID not provided' };
  }

  // Check if the payload was already used (prevents double usage)
  if (usedPayloads.has(payloadUUID)) {
    console.log('Payload already used:', payloadUUID);
    return { success: false, reason: 'Payload already used' };
  }

  console.log('Checking payment for payload:', payloadUUID);

  try {
    // Fetch the payload from XUMM API
    const { data: payload } = await xummApi.payload.get(payloadUUID);

    // Log the payload details
    console.log('Payload details:', payload);

    // Check if the payload is valid and has not expired
    if (!payload || payload.meta.expires_in_seconds <= 0) {
      console.log('Payload expired or invalid');
      return { success: false, reason: 'Payload expired or invalid' };
    }

    // Check if the payload is signed
    if (payload.meta.signed === false) {
      console.log('Payload not signed');
      return { success: false, reason: 'Payload not signed' };
    }

    const tx = payload.response.txn;
    // Log the transaction details
    console.log('Transaction details:', tx);

    // Ensure the transaction is a valid 'Payment' type
    if (!tx || tx.TransactionType !== 'Payment') {
      console.log('Invalid transaction type');
      return { success: false, reason: 'Invalid transaction type' };
    }

    // Ensure the signer is the expected wallet address
    if (tx.Account !== expectedSigner) {
      console.log('Signer mismatch');
      return { success: false, reason: 'Signer mismatch' };
    }

    // Ensure the payment is directed to the correct service wallet
    if (tx.Destination !== SERVICE_WALLET) {
      console.log('Wrong destination');
      return { success: false, reason: 'Wrong destination' };
    }

    // Validate SeagullCoin payment
    const validation = await validateSeagullCoinPayment(tx);
    if (!validation.success) {
      return validation;  // Return the error if validation fails
    }

    // All checks passed, mark payload as used to avoid reuse
    usedPayloads.add(payloadUUID);

    console.log('Payment confirmed successfully');
    return { success: true }; // Payment is valid

  } catch (error) {
    // Enhanced error handling for network/API issues
    if (error.response) {
      // API responded with an error
      console.error('XUMM API error:', error.response.data);
    } else if (error.request) {
      // Request was made, but no response received
      console.error('No response from XUMM API:', error.request);
    } else {
      // Something happened while setting up the request
      console.error('Error during request setup:', error.message);
    }

    return { success: false, reason: 'Error validating payment' }; // Return an error message if any step fails
  }
}

// Your existing SeagullCoin and minting logic

async function processXummMinting(payloadUUID, expectedSigner) {
  try {
    // Validate the wallet address (using the expectedSigner for the minting)
    if (typeof expectedSigner !== 'string' || expectedSigner.trim() === '') {
      throw new Error('Invalid wallet address provided for minting');
    }

    console.log(`Processing minting for wallet: ${expectedSigner}`);

    // Confirm payment before proceeding
    const paymentConfirmed = await confirmPayment(payloadUUID, expectedSigner);
    if (!paymentConfirmed.success) {
      throw new Error(`Insufficient SeagullCoin for minting. Reason: ${paymentConfirmed.reason}`);
    }

    // Your minting logic (e.g., create an NFT transaction, interact with XRPL)
    console.log(`Minting successful for wallet: ${expectedSigner}`);

  } catch (error) {
    console.error('Error during minting process for wallet:', expectedSigner, error.message);
    throw new Error(`Minting failed for wallet ${expectedSigner}: ${error.message}`);
  }
}

export { processXummMinting };
