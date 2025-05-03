import axios from 'axios';

// Define your XUMM API key and endpoint
const XUMM_API_KEY = 'YOUR_XUMM_API_KEY'; // Replace with your XUMM API Key
const XUMM_API_URL = 'https://xumm.app/api/v1'; // XUMM API base URL

// Function to verify the signature using XUMM API
export const verifyXummSignature = async (signature) => {
    try {
        const response = await axios.post(
            `${XUMM_API_URL}/payloads/${signature}`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${XUMM_API_KEY}`
                }
            }
        );
        
        // Check if the signature is valid
        if (response.data.meta.validated) {
            return true;
        } else {
            throw new Error('Invalid signature');
        }
    } catch (error) {
        console.error('Error during signature verification:', error);
        throw new Error('XUMM signature verification failed');
    }
};

// Function to create a payment transaction through XUMM
export const createXummPayment = async (walletAddress) => {
    try {
        const payload = {
            "TransactionType": "Payment",
            "Account": walletAddress,
            "Amount": 0.5 * 1000000, // Convert 0.5 SeagullCoin to drops (1 SeagullCoin = 1,000,000 drops)
            "Destination": 'SERVICE_WALLET_ADDRESS', // Replace with your service wallet address
            "Currency": "SGLCN-X20",
            "Issuer": 'SEAGULL_COIN_ISSUER', // Replace with SeagullCoin issuer
            "DestinationTag": 0
        };

        const response = await axios.post(
            `${XUMM_API_URL}/payloads`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${XUMM_API_KEY}`
                }
            }
        );

        const uuid = response.data.uuid;
        return {
            message: 'Sign the payment transaction to proceed with minting.',
            xummUrl: `https://xumm.app/sign/${uuid}` // URL for the user to sign the transaction
        };
    } catch (error) {
        console.error('Error during payment creation:', error);
        throw new Error('XUMM payment creation failed');
    }
};
