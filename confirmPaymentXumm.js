import { xummApi } from './xrplClient.js'; // Assuming xummApi is already configured
import dotenv from 'dotenv';
dotenv.config();

const payloadUUID = 'your-payload-uuid'; // The UUID from the XUMM payload
const expectedSigner = 'user-wallet-address'; // The wallet address of the user making the payment


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

    const amount = tx.Amount;
    // Log the payment amount
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

    // All checks passed, mark payload as used to avoid reuse
    usedPayloads.add(payloadUUID);

    console.log('Payment confirmed successfully');
    return { success: true }; // Payment is valid

  } catch (error) {
    console.error('Payment verification failed:', error.message);
    return { success: false, reason: 'Error validating payment' }; // Return an error message if any step fails
  }
}
