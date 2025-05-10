<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My NFTs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 2rem;
      background: #f9f9f9;
      color: #333;
    }

    h1 {
      text-align: center;
    }

    #wallet-form {
      text-align: center;
      margin-bottom: 2rem;
    }

    #nft-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem;
    }

    .nft-card {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 1rem;
      width: 220px;
      text-align: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }

    .nft-card:hover {
      transform: scale(1.03);
    }

    .nft-card img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }

    .nft-card p {
      font-weight: bold;
      margin: 0.5rem 0;
    }

    .nft-card small {
      color: #666;
      word-break: break-all;
      font-size: 12px;
    }
  </style>
</head>
<body>

  <h1>View Your NFTs</h1>

  <div id="wallet-form">
    <input type="text" id="wallet-input" placeholder="Enter XRPL Wallet Address" size="45">
    <button onclick="loadNFTs()">Load NFTs</button>
  </div>

  <div id="nft-container">
    <!-- NFT cards will be injected here -->
  </div>

  <script>
    async function loadNFTs() {
      const wallet = document.getElementById('wallet-input').value.trim();
      const container = document.getElementById('nft-container');

      if (!wallet) {
        alert('Please enter a wallet address');
        return;
      }

      container.innerHTML = '<p>Loading NFTs...</p>';

      try {
        const res = await fetch(`/nfts/${wallet}`);
        const data = await res.json();

        container.innerHTML = '';

        if (!data.nfts || data.nfts.length === 0) {
          container.innerHTML = '<p>No NFTs found for this wallet.</p>';
          return;
        }

        data.nfts.forEach(nft => {
          const card = document.createElement('div');
          card.className = 'nft-card';

          const img = document.createElement('img');
          img.src = nft.icon || 'https://via.placeholder.com/200?text=No+Image';
          img.alt = nft.collection || 'NFT';
          img.onerror = () => img.src = 'https://via.placeholder.com/200?text=Image+Error';
          card.appendChild(img);

          const name = document.createElement('p');
          name.textContent = nft.metadata?.name || nft.collection || 'Unnamed NFT';
          card.appendChild(name);

          const id = document.createElement('small');
          id.textContent = nft.NFTokenID;
          card.appendChild(id);

          container.appendChild(card);
        });
      } catch (err) {
        console.error('Error loading NFTs:', err);
        container.innerHTML = '<p>Failed to load NFTs. Please try again later.</p>';
      }
    }
  </script>

</body>
</html>
