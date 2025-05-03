// xrpl-utils.js
export async function createNftOffer(client, wallet, nftokenID, amount, isSellOffer = true) {
  const offerTx = {
    TransactionType: 'NFTokenCreateOffer',
    Account: wallet.classicAddress,
    NFTokenID: nftokenID,
    Amount: amount, // object for SeagullCoin or string for XRP drops
    Flags: isSellOffer ? 1 : 0
  }

  const prepared = await client.autofill(offerTx)
  const signed = wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  return result
}
