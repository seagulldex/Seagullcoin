// xummApi.js
import { xummApi } from './xummClient.js';  // Import your xummApi instance if you have it

// XUMM signature verification
export const verifyXummSignature = async (signature) => {
    try {
        console.log('Started signature verification process...');
        
        // Replace with actual XUMM API verification logic
        const response = await xummApi.verifySignature(signature);  // Actual verification logic here

        console.log('XUMM verification response:', response);

        if (response && response.isValid) {
            console.log('Signature is valid.');
            return true;
        } else {
            console.log('Signature is invalid.');
            return false;
        }
    } catch (error) {
        console.error('Error during XUMM signature verification:', error);
        throw new Error('XUMM signature verification failed');
    }
};

// Function to create XUMM payment transaction for 0.5 SeagullCoin
export const createXummPayment = async (walletAddress) => {
  try {
    const xummPayload = {
      "TransactionType": "Payment",
      "Account": walletAddress,
      "Amount": 0.5 * 1000000, // Convert 0.5 SeagullCoin to drops (1 SeagullCoin = 1,000,000 drops)
      "Destination": SERVICE_WALLET, // Service wallet to receive the payment
      "Currency": "SGLCN-X20", // SeagullCoin currency code
      "Issuer": SEAGULL_COIN_ISSUER,
      "DestinationTag": 0
    };

    const xummTx = await xummApi.payload.create({ txjson: xummPayload });

    // Send back the XUMM URL for the user to sign the transaction
    return {
      message: 'Sign the payment transaction to proceed with minting.',
      xummUrl: `https://xumm.app/sign/${xummTx.data.uuid}` // Direct the user to the XUMM app
    };
  } catch (error) {
    console.error('Error creating XUMM payment transaction:', error);
    throw new Error('Payment creation failed.');
  }
};
