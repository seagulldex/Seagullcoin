import { Xumm } from 'xumm-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize XUMM with your API credentials
const xumm = new Xumm(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

// Constants
const SERVICE_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U'; // Replace with your real wallet
const SEAGULL_COIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const SEAGULL_COIN_AMOUNT = '500000'; // 0.5 SeagullCoin in drops as a string

// Create a XUMM payment payload
export const createXummPayment = async (walletAddress) => {
  try {
    const xummPayload = {
      TransactionType: 'Payment',
      Account: walletAddress,
      Destination: SERVICE_WALLET,
      Amount: {
        currency: 'SeagullCoin',
        issuer: SEAGULL_COIN_ISSUER,
        value: '0.5'
      },
      DestinationTag: 0
    };

    const xummTx = await xumm.payload.create({ txjson: xummPayload });

    return {
      message: 'Sign the payment transaction to proceed with minting.',
      uuid: xummTx.uuid,
      xummUrl: `https://xumm.app/sign/${xummTx.uuid}`
    };
  } catch (error) {
    console.error('Error creating XUMM payment transaction:', error);
    throw new Error('Payment creation failed.');
  }
};


// Confirm the payment transaction
export const confirmPayment = async (payloadUuid) => {
  try {
    const txDetails = await xumm.payload.get(payloadUuid);

    if (!txDetails.meta.resolved_at) {
      return { success: false, reason: 'Transaction expired or not completed in time.' };
    }
    
    if (!txDetails || !txDetails.response || !txDetails.response.dispatched) {
      return { success: false, reason: 'Transaction not signed or not submitted.' };
    }

    const tx = txDetails.response.txn;

    const isValid =
      tx.TransactionType === 'Payment' &&
      tx.Destination === SERVICE_WALLET &&
      tx.Amount.currency === 'SeagullCoin' &&
      tx.Amount.issuer === SEAGULL_COIN_ISSUER &&
      tx.Amount.value === '0.5';

    return isValid
      ? { success: true }
      : { success: false, reason: 'Invalid payment details.' };
  } catch (error) {
    console.error('Error confirming payment:', error);
    return { success: false, reason: 'Error confirming payment.' };
  }
};
