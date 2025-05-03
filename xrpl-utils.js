// xrpl-utils.js
import { Client, Wallet } from 'xrpl'

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

  return result
}
