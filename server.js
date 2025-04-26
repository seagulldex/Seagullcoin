import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { mintNFT } from './mintingLogic.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// XUMM OAuth2 constants from .env
const XUMM_CLIENT_ID = process.env.XUMM_CLIENT_ID;
const XUMM_CLIENT_SECRET = process.env.XUMM_CLIENT_SECRET;
const XUMM_REDIRECT_URI = process.env.XUMM_REDIRECT_URI;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "sglcn_secret_session",
  resave: false,
  saveUninitialized: true,
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Swagger JSON for API docs
app.get('/swagger.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger.json'));
});

// ========== XUMM OAUTH2 ==========
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

// Logout
app.get("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/docs");
  });
});

// Check authenticated user
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

// ======= PING TEST =======
app.get("/api/ping", (req, res) => {
  res.json({ status: "SGLCN-X20 Minting API is alive" });
});

// ======= NFT Minting Route =======
const upload = multer({ dest: 'uploads/' }); // For file uploads
app.post('/mint', upload.single('nft_file'), async (req, res) => {
  const { nft_name, nft_description, domain, properties } = req.body;
  const nft_file = req.file;

  try {
    const result = await mintNFT(nft_name, nft_description, nft_file, domain, properties);

    if (result.success) {
      res.json({ success: true, nftId: result.nftId });
    } else {
      res.status(500).json({ error: 'Minting failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/docs`);
});
