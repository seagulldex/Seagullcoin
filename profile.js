let nftCache = [];
let offersCache = [];
let listingsCache = [];
let currentNFTPage = 1;
const pageSize = 8;

window.addEventListener('DOMContentLoaded', async () => {
  const user = JSON.parse(localStorage.getItem('xumm_user'));
  if (!user) return alert('Please login via XUMM');

  document.getElementById('wallet-id').innerText = `Wallet: ${user.account}`;

  const avatar = localStorage.getItem(`avatar_${user.account}`);
  if (avatar) document.getElementById('profile-pic').src = avatar;

  await Promise.all([
    loadNFTs(user.account),
    loadOffers(user.account),
    loadListings(user.account),
  ]);

  document.getElementById('filter-input')?.addEventListener('input', e => {
    filterNFTs(e.target.value);
  });

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentNFTPage > 1) {
      currentNFTPage--;
      renderNFTs();
    }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    const maxPage = Math.ceil(nftCache.length / pageSize);
    if (currentNFTPage < maxPage) {
      currentNFTPage++;
      renderNFTs();
    }
  });
});

document.getElementById('upload-avatar')?.addEventListener('change', e => {
  const reader = new FileReader();
  reader.onload = function (event) {
    const imgSrc = event.target.result;
    const user = JSON.parse(localStorage.getItem('xumm_user'));
    if (user && imgSrc) {
      localStorage.setItem(`avatar_${user.account}`, imgSrc);
      document.getElementById('profile-pic').src = imgSrc;
    }
  };
  if (e.target.files.length > 0) reader.readAsDataURL(e.target.files[0]);
});

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  const tab = document.getElementById(`${tabName}-tab`);
  if (tab) tab.style.display = 'block';
}

function filterNFTs(query) {
  const lower = query.toLowerCase();
  const filtered = nftCache.filter(nft =>
    nft.name.toLowerCase().includes(lower) || (nft.collection || '').toLowerCase().includes(lower)
  );
  renderNFTs(filtered);
}

function renderNFTs(data = null) {
  const container = document.getElementById('owned-nfts');
  if (!container) return;

  const pageData = (data || nftCache).slice((currentNFTPage - 1) * pageSize, currentNFTPage * pageSize);
  container.innerHTML = '';

  pageData.forEach(nft => {
    const div = document.createElement('div');
    div.innerHTML = `
      <img src="${nft.image}" style="width:100%; border-radius:10px"/>
      <p>${nft.name}</p>
    `;
    container.appendChild(div);
  });
}

async function loadNFTs(wallet) {
  try {
    const res = await fetch(`/get-nfts/${wallet}`);
    const { nfts } = await res.json();
    nftCache = nfts;
    currentNFTPage = 1;
    renderNFTs();
  } catch (err) {
    console.error('Failed to load NFTs:', err);
  }
}

async function loadOffers(wallet) {
  try {
    const res = await fetch(`/get-incoming-offers/${wallet}`);
    const { offers } = await res.json();
    offersCache = offers;

    const container = document.getElementById('incoming-offers');
    if (!container) return;

    container.innerHTML = '';
    offers.forEach(offer => {
      const div = document.createElement('div');
      div.innerHTML = `
        <p>Offer: ${offer.amount} SeagullCoin for <b>${offer.nftName}</b></p>
        <button onclick="handleOffer('${offer.offerIndex}', 'accept')">✅ Accept</button>
        <button onclick="handleOffer('${offer.offerIndex}', 'reject')">❌ Reject</button>
        <hr/>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load offers:', err);
  }
}

async function handleOffer(offerIndex, action) {
  try {
    const res = await fetch(`/offer/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerIndex }),
    });
    const { success } = await res.json();
    if (success) {
      alert(`${action === 'accept' ? 'Accepted' : 'Rejected'} offer ${offerIndex}`);
      const user = JSON.parse(localStorage.getItem('xumm_user'));
      await loadOffers(user.account);
      await loadNFTs(user.account);
      await loadListings(user.account);
    } else {
      alert(`Failed to ${action} offer.`);
    }
  } catch (err) {
    console.error(`Error during offer ${action}:`, err);
    alert(`Error while processing offer.`);
  }
}

async function loadListings(wallet) {
  try {
    const res = await fetch(`/get-my-listings/${wallet}`);
    const { listings } = await res.json();
    listingsCache = listings;

    const container = document.getElementById('my-listings');
    if (!container) return;

    container.innerHTML = '';
    listings.forEach(listing => {
      const div = document.createElement('div');
      div.innerHTML = `<p>For Sale: ${listing.nftName} @ ${listing.amount} SeagullCoin</p>`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load listings:', err);
  }
}
