import { xummApi } from './xrplClient.js'; // Assuming xummApi is already configured
import dotenv from 'dotenv';
dotenv.config();
import { db } from './dbsetup.js'; // Assumes you created and exported db from db.js or server.js


const payloadUUID = 'your-payload-uuid'; // The UUID from the XUMM payload
const expectedSigner = 'user-wallet-address'; // The wallet address of the user making the payment


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

const verifyPayment = (walletAddress, tokenCode, expectedAmount = '0.5') => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM payments
      WHERE wallet_address = ? AND token_code = ? AND status = 'confirmed'
      ORDER BY timestamp DESC LIMIT 1
    `;
    
    db.get(query, [walletAddress, tokenCode], (err, payment) => {
      if (err) {
        return reject(err);
      }
      
      if (!payment) {
        return reject(new Error('Payment not found or not confirmed.'));
      }
      
      if (payment.amount !== expectedAmount) {
        return reject(new Error(`Incorrect payment amount. Expected: ${expectedAmount}, Found: ${payment.amount}`));
      }
      
      resolve(payment);  // Payment is valid
    });
  });
};

export { verifyPayment };

/**
 * Confirm the XUMM payment was signed and meets all SeagullCoin minting criteria.
 * @param {string} payloadUUID - The XUMM payload UUID from the client.
 * @param {string} expectedSigner - The wallet address of the user (the expected signer).
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function confirmPayment(payloadUUID, expectedSigner) {
  if (!payloadUUID) {
    console.error('Error: payloadUUID is missing');
    return { success: false, reason: 'Payload UUID not provided' };
  }

  // Check if the payload already exists in DB
  const existing = await new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM payments WHERE payload_uuid = ?`,
      [payloadUUID],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (existing) {
    console.log('Payload already used (DB):', payloadUUID);
    return { success: false, reason: 'Payload already used' };
  }

  try {
    const { data: payload } = await xummApi.payload.get(payloadUUID);

    if (!payload || payload.meta.expires_in_seconds <= 0) {
      return { success: false, reason: 'Payload expired or invalid' };
    }
    if (!payload.meta.signed) {
      return { success: false, reason: 'Payload not signed' };
    }

    const tx = payload.response.txn;
    const txHash = payload.response.txid;
    console.log('Transaction hash:', txHash);

    if (!tx || tx.TransactionType !== 'Payment') {
      return { success: false, reason: 'Invalid transaction type' };
    }
    if (tx.Account !== expectedSigner) {
      return { success: false, reason: 'Signer mismatch' };
    }
    if (tx.Destination !== SERVICE_WALLET) {
      return { success: false, reason: 'Wrong destination' };
    }

    const validation = await validateSeagullCoinPayment(tx);
    if (!validation.success) return validation;

    // Insert into DB
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO payments (payload_uuid, wallet_address, amount, token_code, status) VALUES (?, ?, ?, ?, ?)`,
        [payloadUUID, tx.Account, tx.Amount.value, tx.Amount.currency, 'confirmed'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log('Payment confirmed and recorded.');
    return { success: true };

  } catch (error) {
    if (error.response) console.error('XUMM API error:', error.response.data);
    else if (error.request) console.error('No response from XUMM API:', error.request);
    else console.error('Error during request setup:', error.message);

    return { success: false, reason: 'Error validating payment' };
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
