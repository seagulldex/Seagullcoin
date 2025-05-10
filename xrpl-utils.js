// xrpl-utils.js
import { Client, Wallet } from 'xrpl'
import xrpl from 'xrpl';
/**
 * Create an NFT offer (buy or sell) on the XRPL.
 * @param {Client} client - XRPL client instance
 * @param {Wallet} wallet - XRPL wallet
 * @param {string} nftokenID - ID of the NFT
 * @param {string|object} amount - Amount in drops (XRP) or object for issued currency (like SeagullCoin)
 * @param {boolean} isSellOffer - true for sell, false for buy
 * @returns {object} XRPL transaction result
 */
export async function createNftOffer(client, wallet, nftokenID, amount, isSellOffer = true) {
  const offerTx = {
    TransactionType: 'NFTokenCreateOffer',
    Account: wallet.classicAddress,
    NFTokenID: nftokenID,
    Amount: amount,
    Flags: isSellOffer ? 1 : 0
  }

  const prepared = await client.autofill(offerTx)
  const signed = wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)


const SERVICE_WALLET_SEED = process.env.SERVICE_WALLET_SEED;

async function broadcastNFTMint(minterWalletAddress, metadataUrl) {
  try {
    await client.connect();
    const wallet = xrpl.Wallet.fromSeed(SERVICE_WALLET_SEED);

    const nftMintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet.classicAddress,
      URI: xrpl.convertStringToHex(metadataUrl),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0
    };

    const prepared = await client.autofill(nftMintTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error('NFT mint failed: ' + result.result.meta.TransactionResult);
    }

    const tokenId = result.result.meta.nftoken_id || extractTokenId(result.result.meta);
    await client.disconnect();
    return tokenId;
  } catch (err) {
    console.error('Error broadcasting NFT mint:', err);
    await client.disconnect();
    throw err;
  }
}

function extractTokenId(meta) {
  const created = meta?.AffectedNodes?.find(
    (node) => node?.CreatedNode?.LedgerEntryType === 'NFTokenPage'
  );

  if (created?.CreatedNode?.NewFields?.NFTokens?.length) {
    return created.CreatedNode.NewFields.NFTokens[0].NFToken.NFTokenID;
  }

  const modified = meta?.AffectedNodes?.find(
    (node) => node?.ModifiedNode?.LedgerEntryType === 'NFTokenPage'
  );

  if (modified?.ModifiedNode?.FinalFields?.NFTokens) {
    const tokens = modified.ModifiedNode.FinalFields.NFTokens;
    return tokens[tokens.length - 1]?.NFToken?.NFTokenID;
  }

  return null;
}

module.exports = {
  broadcastNFTMint
};

  
  
  return result
}
