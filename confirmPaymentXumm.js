import { xummApi } from './xrplClient.js';
import dotenv from 'dotenv';
dotenv.config();

const SERVICE_WALLET = process.env.SERVICE_WALLET; // rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;     // rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno
const SGLCN_CODE = '53656167756C6C436F696E000000000000000000'; // Hex for SeagullCoin

const usedPayloads = new Set(); // In-memory cache to prevent reuse

/**
 * Confirm a XUMM payment was signed and meets all SGLCN minting criteria.
 * @param {string} payloadUUID - The XUMM payload UUID from the client.
 * @param {string} expectedSigner - The wallet address of the user.
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function confirmPayment(payloadUUID, expectedSigner) {
  if (usedPayloads.has(payloadUUID)) {
    return { success: false, reason: 'Payload already used' };
  }

  try {
    const { data: payload } = await xummApi.payload.get(payloadUUID);

    if (!payload || payload.meta.expires_in_seconds <= 0) {
      return { success: false, reason: 'Payload expired or invalid' };
    }

    if (payload.meta.signed === false) {
      return { success: false, reason: 'Payload not signed' };
    }

    const tx = payload.response.txn;
    if (!tx || tx.TransactionType !== 'Payment') {
      return { success: false, reason: 'Invalid transaction type' };
    }

    if (tx.Account !== expectedSigner) {
      return { success: false, reason: 'Signer mismatch' };
    }

    if (tx.Destination !== SERVICE_WALLET) {
      return { success: false, reason: 'Wrong destination' };
    }

    const amount = tx.Amount;
    if (typeof amount !== 'object' || amount.currency !== SGLCN_CODE || amount.issuer !== SGLCN_ISSUER) {
      return { success: false, reason: 'Payment must be SeagullCoin (X20)' };
    }

    if (parseFloat(amount.value) !== 0.5) {
      return { success: false, reason: 'Incorrect SeagullCoin amount' };
    }

    // Success — mark payload as used
    usedPayloads.add(payloadUUID);
    return { success: true };

  } catch (error) {
    console.error('Payment verification failed:', error.message);
    return { success: false, reason: 'Error validating payment' };
  }
}
