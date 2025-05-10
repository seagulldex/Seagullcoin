
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
      justify-content: space-between;
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

    #logout-button {
      padding: 3px 8px;
      font-size: 0.96rem;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      position: relative;
      top: -5px; /* Adjust this value to move the button higher */
    }

    #logout-button:hover {
      background-color: #0056b3;
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
      color: white;
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
      height: 50px;
      margin-top: 10px;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #ccc;
      background-color: #333;
      color: #fff;
      resize: vertical;
    }

    button {
      margin-top: 10px;
      padding: 8px 16px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }

    .website-link {
      margin-top: 10px;
      font-size: 1rem;
      display: inline-block;
      text-decoration: none;
      color: #007bff;
    }

    .nft-section {
      margin-top: 20px;
      text-align: center;
      padding: 20px;
      background-color: #000;
      border-radius: 8px;
      height: 33vh;
      overflow-y: scroll;
      color: #fff;
    }

    .nft-card {
      display: inline-block;
      width: 150px;
      margin: 10px;
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
      background-color: #222;
      color: #fff;
    }

    .nft-card img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      border-radius: 6px;
    }

    .pagination {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }

    .pagination button {
      padding: 8px 16px;
      margin: 0 5px;
      cursor: pointer;
      border-radius: 6px;
      border: 1px solid #ddd;
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
    <button id="logout-button" onclick="logout()">Logout</button>
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
    <div class="profile-section">
      <h1>User Profile</h1>
      <img id="profile-img" class="profile-picture" src="default-avatar.png" alt="Profile Picture" />
      <input type="file" id="profile-upload" accept="image/*" />
      <textarea id="bio" placeholder="Write something about yourself..."></textarea>
      <button onclick="saveProfile()">Save Profile</button>

      <div class="website-link-section">
        <input type="text" id="website-link" placeholder="Enter your website URL" />
        <button onclick="saveWebsiteLink()">Save Website</button>
        <a id="user-website" href="#" class="website-link" target="_blank">Your Website</a>
      </div>
    </div>

    <div class="nft-section" id="nft-section">
      <h2>Your NFTs</h2>
      <div id="nft-list"></div>
      <div class="pagination">
        <button onclick="prevPage()">Previous</button>
        <button onclick="nextPage()">Next</button>
      </div>
      <div>
        <label for="filter">Filter by Trait:</label>
        <select id="filter" onchange="filterNFTs()">
          <option value="">All Traits</option>
          <option value="rare">Rare</option>
          <option value="legendary">Legendary</option>
        </select>
      </div>
    </div>
  </main>

  <footer>
    <p>&copy; 2025 SeagullCoin NFT Marketplace</p>
  </footer>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      updateWalletStatus();
      loadProfile();
      loadNFTs();
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

    function logout() {
      localStorage.removeItem('xumm_wallet_address');
      localStorage.removeItem('xumm_user');
      location.reload();
    }

    function loadProfile() {
      const img = localStorage.getItem('user_profile_img');
      const bio = localStorage.getItem('user_bio');
      const website = localStorage.getItem('user_website');
      if (img) document.getElementById('profile-img').src = img;
      if (bio) document.getElementById('bio').value = bio;
      if (website) {
        document.getElementById('website-link').value = website;
        document.getElementById('user-website').href = website;
        document.getElementById('user-website').textContent = website;
      }
    }

    function saveProfile() {
      const bio = document.getElementById('bio').value;
      localStorage.setItem('user_bio', bio);
      const fileInput = document.getElementById('profile-upload');
      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('profile-img').src = e.target.result;
          localStorage.setItem('user_profile_img', e.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    }

    function saveWebsiteLink() {
      const url = document.getElementById('website-link').value;
      localStorage.setItem('user_website', url);
      document.getElementById('user-website').href = url;
      document.getElementById('user-website').textContent = url;
    }

    function loadNFTs() {
      const dummyNFTs = [
        { id: 1, name: "Rare Seagull", img: "nft1.png", trait: "rare" },
        { id: 2, name: "Legendary Seagull", img: "nft2.png", trait: "legendary" },
        { id: 3, name: "Common Seagull", img: "nft3.png", trait: "common" },
      ];

      const nftList = document.getElementById('nft-list');
      nftList.innerHTML = "";
      dummyNFTs.forEach(nft => {
        const nftCard = document.createElement('div');
        nftCard.classList.add('nft-card');
        nftCard.innerHTML = `
          <img src="${nft.img}" alt="${nft.name}">
          <h3>${nft.name}</h3>
        `;
        nftList.appendChild(nftCard);
      });
    }

    function filterNFTs() {
      const trait = document.getElementById('filter').value;
      loadNFTs();  // Call the function to reload NFTs based on the filter.
    }

    function nextPage() {
      console.log('Next page clicked');
      // Implement pagination logic.
    }

    function prevPage() {
      console.log('Previous page clicked');
      // Implement pagination logic.
    }
  </script>
</body>
</html>
