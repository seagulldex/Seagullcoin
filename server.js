const express = require("express");
const session = require("express-session");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const multer = require("multer");
require("dotenv").config();

// Your minting logic
const { mintNFT } = require("./mintingLogic"); // Import minting logic

const app = express();

// XUMM OAuth2 constants from .env
const XUMM_CLIENT_ID = process.env.XUMM_CLIENT_ID;
const XUMM_CLIENT_SECRET = process.env.XUMM_CLIENT_SECRET;
const XUMM_REDIRECT_URI = process.env.XUMM_REDIRECT_URI;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(session({
  secret: "sglcn_secret_session",
  resave: false,
  saveUninitialized: true,
}));

// Serve static files like HTML, CSS, JS
app.use(express.static(path.join(__dirname, "public")));

// XUMM OAuth2 Routes (Login, Logout, etc.)
app.get("/api/login", (req, res) => {
  const authUrl = `https://oauth2.xumm.app/auth?client_id=${XUMM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}&scope=identity%20payload`;
  res.redirect(authUrl);
});

app.get("/api/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const tokenRes = await fetch("https://oauth2.xumm.app/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${XUMM_CLIENT_ID}:${XUMM_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(XUMM_REDIRECT_URI)}`,
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

app.get("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/docs");
  });
});

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

// ======= MINTING ROUTE ========
const upload = multer({ dest: "uploads/" });

app.post("/mint", upload.single("nft_file"), async (req, res) => {
  const { nft_name, nft_description } = req.body;
  const nft_file = req.file;

  try {
    // Call the minting logic
    const result = await mintNFT(nft_name, nft_description, nft_file);

    if (result.success) {
      res.json({ success: true, nftId: result.nftId });
    } else {
      res.status(500).json({ error: "Minting failed" });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ======= SAMPLE PING ENDPOINT ========
app.get("/api/ping", (req, res) => {
  res.json({ status: "SGLCN-X20 Minting API is alive" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
