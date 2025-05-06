// public/wallet.js

document.addEventListener("DOMContentLoaded", async () => {
  const walletIndicator = document.getElementById("wallet-indicator");

  const userData = localStorage.getItem("xumm_user");
  if (userData) {
    try {
      const user = JSON.parse(userData);
      walletIndicator.textContent = `🟢 ${user.account.substr(0, 6)}...`;
      walletIndicator.classList.remove("red");
      walletIndicator.classList.add("green");
      walletIndicator.style.cursor = "pointer";
      walletIndicator.onclick = () => {
        window.location.href = `/profile.html?uuid=${user.uuid}`;
      };
    } catch (e) {
      console.error("Failed to parse user data", e);
      walletIndicator.textContent = "🔴 Login";
    }
  } else {
    walletIndicator.textContent = "🔴 Login";
    walletIndicator.onclick = () => {
      window.location.href = "/connect.html"; // Adjust this if your login flow is different
    };
  }
});
