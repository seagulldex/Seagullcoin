import { xummApi } from './xrplClient.js'; // Assuming xummApi is already configured
import dotenv from 'dotenv';
dotenv.config();

const SERVICE_WALLET = process.env.SERVICE_WALLET;  // Minting wallet (Service Wallet)
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;     // SeagullCoin issuer address
const SGLCN_CODE = '53656167756C6C436F696E000000000000000000'; // Hex for SeagullCoin
const usedPayloads = new Set(); // In-memory cache to prevent reuse

/**
 * Confirm the XUMM payment was signed and meets all SeagullCoin minting criteria.
 * @param {string} payloadUUID - The XUMM payload UUID from the client.
 * @param {string} expectedSigner - The wallet address of the user (the expected signer).
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function confirmPayment(payloadUUID, expectedSigner) {
  // Check if the payload was already used (prevents double usage)
  if (usedPayloads.has(payloadUUID)) {
    return { success: false, reason: 'Payload already used' };
  }

  try {
    // Fetch the payload from XUMM API
    const { data: payload } = await xummApi.payload.get(payloadUUID);

    // Check if the payload is valid and has not expired
    if (!payload || payload.meta.expires_in_seconds <= 0) {
      return { success: false, reason: 'Payload expired or invalid' };
    }

    // Check if the payload is signed
    if (payload.meta.signed === false) {
      return { success: false, reason: 'Payload not signed' };
    }

    const tx = payload.response.txn;
    
    // Ensure the transaction is a valid 'Payment' type
    if (!tx || tx.TransactionType !== 'Payment') {
      return { success: false, reason: 'Invalid transaction type' };
    }

    // Ensure the signer is the expected wallet address
    if (tx.Account !== expectedSigner) {
      return { success: false, reason: 'Signer mismatch' };
    }

    // Ensure the payment is directed to the correct service wallet
    if (tx.Destination !== SERVICE_WALLET) {
      return { success: false, reason: 'Wrong destination' };
    }

    const amount = tx.Amount;
    
    // Validate the currency is SeagullCoin and the amount is correct (0.5 SGLCN)
    if (typeof amount !== 'object' || amount.currency !== SGLCN_CODE || amount.issuer !== SGLCN_ISSUER) {
      return { success: false, reason: 'Payment must be SeagullCoin (X20)' };
    }

    // Ensure that the amount is exactly 0.5
    if (parseFloat(amount.value) !== 0.5) {
      return { success: false, reason: 'Incorrect SeagullCoin amount' };
    }

    // All checks passed, mark payload as used to avoid reuse
    usedPayloads.add(payloadUUID);

    return { success: true }; // Payment is valid

  } catch (error) {
    console.error('Payment verification failed:', error.message);
    return { success: false, reason: 'Error validating payment' }; // Return an error message if any step fails
  }
}

console.log('Checking payment for payload:', payloadUUID);
console.log('Payload details:', payload);
console.log('Transaction details:', tx);
console.log('Payment amount:', tx.Amount);
console.log('Signer:', tx.Account);
console.log('Expected signer:', expectedSigner);

