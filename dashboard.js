// dashboard.js
async function fetchUserBalance() {
  const balance = await getWalletBalance(); // Replace with actual XUMM API method
  document.getElementById('user-balance').innerText = `Balance: ${balance} SGLCN`;
}

async function fetchUserNFTs() {
  const nfts = await getUserNFTs(); // Replace with actual API for fetching NFTs
  document.getElementById('user-nfts').innerHTML = nfts.map(nft => `
    <div class="nft">
      <img src="${nft.image}" alt="${nft.name}" />
      <p>${nft.name}</p>
    </div>
  `).join('');
}
// dashboard.js

window.onload = async () => {
  await fetchUserBalance();
  await fetchUserNFTs();
};
