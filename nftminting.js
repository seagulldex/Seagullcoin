export async function mintNFT(walletAddress, nftData) {
  try {
    // Validate wallet address
    if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(walletAddress)) {
      return { success: false, error: 'Invalid XRPL wallet address.' };
    }

    // Validate NFT data
    if (!nftData.name || !nftData.description || !nftData.fileBase64 || !nftData.filename) {
      return { success: false, error: 'Missing NFT metadata or file.' };
    }

    // Convert base64 to File object
    const buffer = Buffer.from(nftData.fileBase64, 'base64');
    const file = new File([buffer], nftData.filename, {
      type: mime.getType(nftData.filename),
    });

    // Store on NFT.Storage
    const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
    const metadata = await client.store({
      name: nftData.name,
      description: nftData.description,
      image: file,
      properties: nftData.properties || {},
    });

    // Prepare XRPL mint transaction
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0,
      Amount: {
        currency: 'SeagullCoin',
        issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno',
        value: '0.5',
      },
    };

    // Create XUMM payload
    const payload = await xumm.payload.create({ txjson: tx });

    return {
      success: true,
      nftStorageUrl: metadata.url,
      mintPayloadUrl: `https://xumm.app/sign/${payload.uuid}`,
      mintPayloadId: payload.uuid,
    };
  } catch (err) {
    console.error('Minting failed:', err);
    return { success: false, error: 'Minting failed: ' + err.message };
  }
}
