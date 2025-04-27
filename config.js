import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Define constants using environment variables or hardcode values
export const XUMM_API_URL = process.env.XUMM_API_URL || 'https://xumm.app/api/v1';
export const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY || 'your-nft-storage-api-key';
export const SGLCN_ISSUER = process.env.SGLCN_ISSUER || 'your-seagullcoin-issuer';
export const SERVICE_WALLET = process.env.SERVICE_WALLET || 'your-service-wallet-address';
export const XUMM_API_KEY = process.env.XUMM_API_KEY || 'your-xumm-api-key';
