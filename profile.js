document.addEventListener("DOMContentLoaded", async () => {
    const wallet = localStorage.getItem("xummWallet");

    if (!wallet) {
        document.getElementById("profile-content").innerHTML = `
            <p>Please connect your wallet to view your profile.</p>
        `;
        return;
    }

    // Display wallet address
    document.getElementById("wallet-address").textContent = wallet;

    try {
        // Fetch user NFTs
        const res = await fetch(`/api/user-nfts?wallet=${wallet}`);
        const data = await res.json();

        if (data && data.nfts && data.nfts.length > 0) {
            const nftContainer = document.getElementById("user-nfts");
            data.nfts.forEach(nft => {
                const div = document.createElement("div");
                div.className = "nft-item";
                div.innerHTML = `
                    <img src="${nft.image}" alt="${nft.name}" style="width:100%; border-radius: 10px;">
                    <h3>${nft.name}</h3>
                    <p>${nft.description}</p>
                `;
                nftContainer.appendChild(div);
            });
        } else {
            document.getElementById("user-nfts").innerHTML = `<p>No NFTs found.</p>`;
        }
    } catch (error) {
        console.error("Error loading NFTs:", error);
        document.getElementById("user-nfts").innerHTML = `<p>Error loading NFTs.</p>`;
    }

    // Optional: Load SeagullCoin balance
    try {
        const res = await fetch(`/api/balance?wallet=${wallet}`);
        const { balance } = await res.json();
        document.getElementById("wallet-balance").textContent = `${balance} SGLCN`;
    } catch (err) {
        console.error("Error fetching balance:", err);
    }
});
