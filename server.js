const express = require("express");
const session = require("express-session");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const multer = require("multer");
const { mintNFT } = require("./mintingLogic");
require("dotenv").config();

const app = express();

// XUMM OAuth2 constants from .env
const XUMM_CLIENT_ID = process.env.XUMM_CLIENT_ID;
const XUMM_CLIENT_SECRET = process.env.XUMM_CLIENT_SECRET;
const XUMM_REDIRECT_URI = process.env.XUMM_REDIRECT_URI;
const XUMM_ACCESS_TOKEN = process.env.XUMM_ACCESS_TOKEN; // Ensure this is correctly set

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "sglcn_secret_session",
    resave: false,
    saveUninitialized: true,
  })
);

// Setup for serving static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Serve swagger.json for documentation
app.get("/swagger.json", (req, res) => {
  res.sendFile(path.join(__dirname, "swagger.json"));
});

// ======= LOGIN (OAuth2) ========
app.get("/api/login", (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
    XUMM_REDIRECT_URI
  )}&scope=identity%20payload`;
  res.redirect(authUrl);
});

// ======= OAUTH2 CALLBACK ========
app.get("/api/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const tokenRes = await fetch("https://oauth2.xumm.app/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${XUMM_CLIENT_ID}:${XUMM_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(
        XUMM_REDIRECT_URI
      )}`,
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      req.session.xumm = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      };
      res.redirect("/docs");
    } else {
      res.status(400).json({ error: "Failed to authenticate with XUMM" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth2 Error");
  }
});

// ======= LOGOUT ========
app.get("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/docs");
  });
});

// ======= AUTH CHECK ========
app.get("/api/user", async (req, res) => {
  if (!req.session.xumm) return res.status(401).json({ error: "Not authenticated" });

  try {
    const userRes = await fetch("https://oauth2.xumm.app/userinfo", {
      headers: { Authorization: `Bearer ${req.session.xumm.access_token}` },
    });
    const userInfo = await userRes.json();
    res.json(userInfo);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ======= SAMPLE PING ENDPOINT ========
app.get("/api/ping", (req, res) => {
  res.json({ status: "SGLCN-X20 Minting API is alive" });
});

// ======= Check SeagullCoin Balance ========
const fetchSeagullCoinBalance = async (address) => {
  const url = `https://xumm.app/api/v1/platform/accounts/${address}/balances`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${XUMM_ACCESS_TOKEN}`, // Replace with the actual XUMM token
    },
  });
  const data = await response.json();
  const seagullCoinBalance = data.balances.find((b) => b.currency === "SGLCN-X20");

  return seagullCoinBalance ? parseFloat(seagullCoinBalance.value) : 0;
};

// ======= NFT Minting Route ========
const upload = multer({ dest: "uploads/" }); // To handle file uploads
app.post("/mint", upload.single("nft_file"), async (req, res) => {
  const { nft_name, nft_description, domain, properties, userAddress } = req.body;
  const nft_file = req.file;

  try {
    // Check if user has enough SeagullCoin
    const balance = await fetchSeagullCoinBalance(userAddress);
    if (balance < 0.5) {
      return res.status(400).json({ error: "Insufficient SeagullCoin balance to mint NFT" });
    }

    // Proceed with minting
    const result = await mintNFT(nft_name, nft_description, nft_file, domain, properties);

    if (result.success) {
      res.json({ success: true, nftId: result.nftId });
    } else {
      res.status(500).json({ error: "Minting failed" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ======= Restrict Offer to SeagullCoin for Buying/Selling NFTs ========
app.post("/buy-nft", async (req, res) => {
  const { nftId, offerAmount, userAddress } = req.body;

  // Check if offer is in SeagullCoin
  if (offerAmount.currency !== "SGLCN-X20") {
    return res.status(400).json({ error: "Only SeagullCoin is accepted for buying NFTs" });
  }

  // Proceed with buying NFT logic here
  try {
    const result = await processNFTOffer(nftId, offerAmount, userAddress);

    if (result.success) {
      res.json({ success: true, message: "NFT purchase offer created" });
    } else {
      res.status(500).json({ error: "Failed to create offer" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ======= Restrict Selling NFT to SeagullCoin ========
app.post("/sell-nft", async (req, res) => {
  const { nftId, sellAmount, userAddress } = req.body;

  // Check if sale amount is in SeagullCoin
  if (sellAmount.currency !== "SGLCN-X20") {
    return res.status(400).json({ error: "Only SeagullCoin is accepted for selling NFTs" });
  }

  // Proceed with selling NFT logic here
  try {
    const result = await processNFTSale(nftId, sellAmount, userAddress);

    if (result.success) {
      res.json({ success: true, message: "NFT sale created" });
    } else {
      res.status(500).json({ error: "Failed to create sale" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/docs`);
});
