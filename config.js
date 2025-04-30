import dotenv from 'dotenv';
dotenv.config();

// Hardcoding SeagullCoin hex for consistent use
export const SGLCN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
export const SEAGULLCOIN_HEX = '53656167756C6C436F696E000000000000000000'; // SeagullCoin hex

// XUMM API keys and settings
export const XUMM_API_URL = process.env.XUMM_API_URL || 'https://xumm.app/api/v1';
export const XUMM_API_KEY = process.env.XUMM_API_KEY || 'your-xumm-api-key';
export const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY || 'your-nft-storage-api-key';

// Service Wallet address
export const SERVICE_WALLET = process.env.SERVICE_WALLET || 'your-service-wallet-address';
