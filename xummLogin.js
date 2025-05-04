import { xummApi } from './xrplClient.js'; // Assuming xummApi is already configured
import dotenv from 'dotenv';

dotenv.config();

const SERVICE_WALLET = process.env.SERVICE_WALLET;

export async function initiateLogin() {
  try {
    // Create a payload requesting user account info
    const response = await xummApi.payload.create({
      transaction: {
        TransactionType: "AccountSet",
        Account: SERVICE_WALLET
      },
      options: {
        submit: false // Don't submit immediately
      }
    });

    const payloadUUID = response.data.uuid;
    const payloadURL = `https://xumm.app/sign/${payloadUUID}`;
    
    return { payloadUUID, payloadURL };
  } catch (error) {
    console.error('Login initiation failed:', error.message);
    return { error: 'Failed to initiate login' };
  }
}
