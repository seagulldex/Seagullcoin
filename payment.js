// payment.js

const xummApi = require('xumm-sdk'); // Ensure to require any necessary modules

// Service constants (you might want to define these in another config file)
const SERVICE_WALLET = 'YOUR_SERVICE_WALLET';
const SEAGULL_COIN_ISSUER = 'YOUR_SEAGULL_COIN_ISSUER';

const createXummPayment = async (walletAddress) => {
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

module.exports = {
  createXummPayment
};
