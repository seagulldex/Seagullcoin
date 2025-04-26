let walletAddress = null;

document.getElementById("connectButton").addEventListener("click", () => {

    // Call XUMM login API here

    xummSdk.request({

        transactionType: "login"

    }).then(async (response) => {

        walletAddress = response.wallet_address;

        document.getElementById("walletAddress").textContent = walletAddress;

        document.getElementById("walletConnect").classList.add("hidden");

        document.getElementById("mintingSection").classList.remove("hidden");

        document.getElementById("userInfo").classList.remove("hidden");

        await loadNFTs();

    }).catch((error) => {

        console.error("XUMM login failed", error);

        showError("Failed to connect wallet.");

    });

});

// Minting an NFT

document.getElementById("mintForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const nftName = document.getElementById("nftName").value;

    const nftFile = document.getElementById("nftFile").files[0];

    const nftDescription = document.getElementById("nftDescription").value;

    if (!nftName || !nftFile || !nftDescription) {

        showError("Please fill in all fields.");

        return;

    }

    const formData = new FormData();

    formData.append("nftName", nftName);

    formData.append("nftFile", nftFile);

    formData.append("nftDescription", nftDescription);

    try {

        const response = await fetch("/api/mint", {

            method: "POST",

            body: formData,

        });

        const data = await response.json();

        if (data.success) {

            alert("NFT minted successfully!");

            loadNFTs();

        } else {

            showError(data.error || "Minting failed.");

        }

    } catch (error) {

        console.error(error);

        showError("Error during minting.");

    }

});

// Fetch user's NFTs

async function loadNFTs() {

    try {

        const response = await fetch(`/api/user/${walletAddress}`);

        const data = await response.json();

        if (data.nfts && data.nfts.length > 0) {

            const nftsList = document.getElementById("nftsList");

            nftsList.innerHTML = "";

            data.nfts.forEach((nft) => {

                const nftItem = document.createElement("div");

                nftItem.classList.add("nftItem");

                nftItem.innerHTML = `

                    <img src="${nft.metadata.image}" alt="${nft.metadata.name}">

                    <p>${nft.metadata.name}</p>

                    <p>${nft.metadata.description}</p>

                `;

                nftsList.appendChild(nftItem);

            });

        } else {

            document.getElementById("nftsList").innerHTML = "<p>No NFTs found.</p>";

        }

    } catch (error) {

        console.error(error);

        showError("Failed to load NFTs.");

    }

}

// Show error message

function showError(message) {

    const errorMessage = document.getElementById("errorMessage");

    errorMessage.textContent = message;

    errorMessage.classList.remove("hidden");

}

// Logout button functionality

document.getElementById("logoutButton").addEventListener("click", () => {

    walletAddress = null;

    document.getElementById("walletConnect").classList.remove("hidden");

    document.getElementById("mintingSection").classList.add("hidden");

    document.getElementById("userInfo").classList.add("hidden");

});

