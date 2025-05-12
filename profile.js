<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>User Profile - SGLCN-X20</title>
  <link rel="stylesheet" href="style.css"/>
  <script src="https://cdn.jsdelivr.net/npm/xumm-sdk/dist/xumm-sdk.bundle.js"></script>
  <link rel="stylesheet" href="header.css" />
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

    .profile-section {
      max-width: 400px;
      margin: 0 auto;
      text-align: center;
    }

    .profile-section input[type="file"] {
      margin-top: 10px;
    }

    .profile-picture {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 50%;
      margin: 10px auto;
      display: block;
      border: 2px solid #333;
    }

    textarea {
      width: 100%;
      height: 100px;
      margin-top: 10px;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #ccc;
      resize: vertical;
    }

    button {
      margin-top: 10px;
      padding: 8px 16px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }

    footer {
      text-align: center;
      padding: 20px;
      font-size: 0.9rem;
      color: #777;
    }

    /* NFT Card Styling */
    .nft-cards-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 20px;
    }

    .nft-card {
      width: 200px;
      height: 320px; /* limit vertical size */
      padding: 10px;
      background-color: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .nft-image {
      width: 100%;
      height: auto;
      border-radius: 8px;
    }

    .nft-card h3 {
      margin-top: 10px;
      font-size: 1.1rem;
    }

    .nft-card p {
      font-size: 0.9rem;
      color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
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
    <div id="nft-cards" class="nft-cards-container">
      <!-- NFT cards will be injected here -->
    </div>
  </main>

  <footer>
    <p>&copy; 2025 SeagullCoin NFT Marketplace</p>
  </footer>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      updateWalletStatus();
      fetchNFTs(); // Fetch and display NFTs
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
        }
      }, 3000);
    }

    async function fetchNFTs() {
      const wallet = 'rKoREYA3cFXPbAUtfj1Y2duMMymuWpuNDE';  // Direct wallet address
      if (!wallet) return;

      try {
        const res = await fetch(`https://sglcn-x20-api.glitch.me/nfts/${wallet}`);
        const data = await res.json();
        console.log('Fetched NFTs:', data);
        renderNFTs(data);
      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
      }
    }

    function renderNFTs(nfts) {
      if (!nfts || !Array.isArray(nfts)) return;
      const container = document.getElementById('nft-cards');
      container.innerHTML = ''; // Clear existing content

      nfts.forEach(nft => {
        const card = document.createElement('div');
        card.classList.add('nft-card');

        const img = document.createElement('img');
        img.src = nft.image || 'default-image-url.jpg';
        img.alt = nft.name || 'NFT Image';
        img.classList.add('nft-image');

        const title = document.createElement('h3');
        title.innerText = nft.name || 'No Name';

        const description = document.createElement('p');
        description.innerText = nft.description || 'No description available';

        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(description);

        container.appendChild(card);
      });
    }
  </script>
</body>
</html>
