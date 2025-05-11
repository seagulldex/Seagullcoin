<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your NFTs - SGLCN-X20</title>
  <link rel="stylesheet" href="style.css"/>
  <link rel="stylesheet" href="header.css" />
  <script src="https://cdn.jsdelivr.net/npm/xumm-sdk/dist/xumm-sdk.bundle.js"></script>
  <style>
    #top-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background-color: #2e2e2e;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 20px;
      z-index: 1000;
    }

    #wallet-container {
      border: 2px solid #000;
      border-radius: 10px;
      padding: 6px 12px;
      background-color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 140px;
    }

    #wallet-status {
      font-size: 0.9rem;
      cursor: pointer;
      font-weight: bold;
    }

    #wallet-indicator.red {
      color: #ff4444;
    }

    #wallet-indicator.green {
      color: #44ff44;
    }

    body {
      margin-top: 60px;
      font-family: Arial, sans-serif;
    }

    header nav ul {
      display: flex;
      list-style-type: none;
      margin: 0;
      padding: 0;
    }

    header nav ul li {
      margin: 0 15px;
    }

    header nav ul li a {
      text-decoration: none;
      color: #333;
      font-weight: bold;
    }

    main {
      padding: 20px;
    }

    .nft-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }

    .nft-card {
      background-color: #f4f4f4;
      border: 1px solid #ccc;
      border-radius: 12px;
      overflow: hidden;
      text-align: center;
      padding: 10px;
    }

    .nft-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 10px;
    }

    .nft-card h3 {
      margin: 10px 0 5px;
      font-size: 1.1rem;
    }

    .nft-card p {
      font-size: 0.9rem;
      color: #555;
    }

    footer {
      text-align: center;
      padding: 20px;
      font-size: 0.9rem;
      color: #777;
    }
  </style>
</head>
<body>

  <div id="top-bar">
    <div id="wallet-container">
      <div id="wallet-status">
        <span id="wallet-indicator" class="red">🔴 Login</span>
      </div>
    </div>
  </div>

  <header>
    <nav>
      <ul>
        <li><a href="index.html">Home</a></li>
        <li><a href="nfts.html">NFTs</a></li>
        <li><a href="mint.html">Mint NFT</a></li>
        <li><a href="messages.html">Messages</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <h1>Your NFTs</h1>
    <div id="nft-board" class="nft-grid"></div>
  </main>

  <footer>
    <p>&copy; 2025 SeagullCoin NFT Marketplace</p>
  </footer>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      updateWalletStatus();
      fetchNFTs();
    });

    async function updateWalletStatus() {
      const wallet = localStorage.getItem('xumm_wallet_address');
      const indicator = document.getElementById('wallet-indicator');

      if (wallet) {
        indicator.textContent = '🟢 Profile';
        indicator.classList.remove('red');
        indicator.classList.add('green');
        indicator.title = 'Logged in';
      } else {
        indicator.textContent = '🔴 Login';
        indicator.classList.remove('green');
        indicator.classList.add('red');
        indicator.title = 'Click to login';
        indicator.onclick = startLoginFlow;
      }
    }

    async function startLoginFlow() {
      const res = await fetch('https://sglcn-x20-api.glitch.me/login');
      const data = await res.json();
      window.open(data.payloadURL, "_blank");

      const interval = setInterval(async () => {
        const check = await fetch(`https://sglcn-x20-api.glitch.me/check-login?uuid=${data.payloadUUID}`);
        const loginStatus = await check.json();

        if (loginStatus.loggedIn) {
          clearInterval(interval);
          localStorage.setItem('xumm_wallet_address', loginStatus.account);
          localStorage.setItem('xumm_user', JSON.stringify(loginStatus));
          updateWalletStatus();
          fetchNFTs(); // Refresh NFTs after login
        }
      }, 3000);
    }

    async function fetchNFTs() {
      const wallet = localStorage.getItem('xumm_wallet_address');
      if (!wallet) return;

      try {
        const res = await fetch(`https://sglcn-x20-api.glitch.me/nfts?wallet=${wallet}`);
        const nfts = await res.json();
        renderNFTs(nfts);
      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
      }
    }

    function renderNFTs(nfts) {
      const board = document.getElementById('nft-board');
      board.innerHTML = '';

      if (!Array.isArray(nfts) || nfts.length === 0) {
        board.innerHTML = '<p>No NFTs found.</p>';
        return;
      }

      nfts.forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';

        card.innerHTML = `
          <img src="${nft.image || 'default-nft.png'}" alt="NFT Image"/>
          <h3>${nft.name || 'Untitled NFT'}</h3>
          <p>${nft.description || ''}</p>
        `;

        board.appendChild(card);
      });
    }
  </script>
</body>
</html>
