import { xummApi } from './xrplClient.js';  // Assuming xummApi is already configured
import dotenv from 'dotenv';
import { handleError, logError } from './errorHandler.js';  // Assuming a custom error handler

dotenv.config();

const SERVICE_WALLET = process.env.SERVICE_WALLET;

/**
 * Initiate login by creating a payload for the user to sign.
 * @returns {Object} { payloadUUID, payloadURL } if successful, or an error message.
 */
export async function initiateLogin() {
  try {
    // Create a payload requesting user account info
    const response = await xummApi.payload.create({
      transaction: {
        TransactionType: "AccountSet",
        Account: SERVICE_WALLET
      },
      options: {
        submit: false // Don't submit the transaction immediately
      }
    });

    const payloadUUID = response.data.uuid;
    const payloadURL = `https://xumm.app/sign/${payloadUUID}`;
    
    return { payloadUUID, payloadURL };
  } catch (error) {
    // Log and handle error
    logError(error);
    return handleError('Failed to initiate login');
  }
}

/**
 * Verify the XUMM login by checking if the user signed the payload.
 * @param {string} payloadUUID - The UUID of the payload to verify.
 * @returns {string|null} - The wallet address if the payload is signed, or null if not.
 */
export async function verifyLogin(payloadUUID) {
  try {
    // Retrieve the payload to check if the user signed it
    const response = await xummApi.payload.get(payloadUUID);

    if (response.data.signed) {
      const userAddress = response.data.response.account;
      console.log('User signed in with address:', userAddress);
      return userAddress;  // Return the user's wallet address
    } else {
      console.log('User did not sign the payload.');
      return null;  // Return null if the payload was not signed
    }
  } catch (error) {
    // Log and handle error
    logError(error);
    return handleError('Error verifying login');
  }
}
