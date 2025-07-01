const nftCache = new Map();
const xrplApiUrl = 'https://xrplcluster.com';

export const fetchAllNFTs = async (wallet) => {
  if (nftCache.has(wallet)) {
    const cachedData = nftCache.get(wallet);
    const currentTime = Date.now();
    if (currentTime - cachedData.timestamp < 60000) {
      return cachedData.data;
    }
  }

  const requestBody = {
    method: 'account_nfts',
    params: [{
      account: wallet,
      ledger_index: 'validated'
    }]
  };

  const response = await fetch(xrplApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  if (data.result?.error) {
    throw new Error(data.result.error_message);
  }

  const nfts = data.result.account_nfts || [];
  nftCache.set(wallet, { data: nfts, timestamp: Date.now() });
  return nfts;
};
