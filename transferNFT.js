// In a new file: transferNFT.js

const xrpl = require('xrpl');

async function transferNFT({ senderWallet, recipientAddress, nftokenId }) {
  try {
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233'); // Testnet or Mainnet URL
    await client.connect();

    const tx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: senderWallet.classicAddress,
      NFTokenID: nftokenId,
      Destination: recipientAddress,
    };

    const signed = await senderWallet.sign(tx);
    const txResult = await client.submitAndWait(signed.tx_blob);
    await client.disconnect();

    return { success: true, result: txResult };
  } catch (error) {
    console.error('Error transferring NFT:', error);
    throw new Error('NFT transfer failed.');
  }
}

module.exports = transferNFT;
