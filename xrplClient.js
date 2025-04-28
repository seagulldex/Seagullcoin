import client from './xrplClient.js'; // or however you initialize your XRPL client

export async function getNFTDetails(nftId) {
  try {
    await client.connect();

    const response = await client.request({
      command: "nft_info",
      nft_id: nftId
    });

    await client.disconnect();

    if (response.result && response.result.nft_info) {
      const nftData = response.result.nft_info;
      return {
        nftId: nftId,
        owner: nftData.Owner,
        uri: nftData.URI,
        flags: nftData.Flags,
        transferFee: nftData.TransferFee,
        issuer: nftData.Issuer,
      };
    } else {
      console.error('No NFT info found for', nftId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching NFT details from XRPL:', error);
    return null;
  }
}
