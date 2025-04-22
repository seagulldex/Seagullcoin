const express = require("express");
const multer = require("multer");
const xrpl = require("xrpl");
const { NFTStorage, File } = require("nft.storage");
const mime = require("mime");
const fs = require("fs");
const path = require("path");
const { XummSdk } = require("xumm-sdk");
const cors = require("cors");
const session = require("express-session");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(session({ secret: "xumm-secret", resave: false, saveUninitialized: true }));

const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";
const SGLCN_CURRENCY = "53656167756C6C436F696E000000000000000000";
const SGLCN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_COST = "0.5";

let mintedNFTs = [];
let collections = {};

// Auth routes
app.get("/login", async (req, res) => {
  const authUrl = await xumm.oauth2.getAuthorizationUrl("https://outgoing-destiny-bladder.glitch.me/callback", true);
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  const state = await xumm.oauth2.codeCallback(code);
  req.session.accessToken = state.jwt;
  req.session.user = state.me;
  res.redirect("/");
});

app.get("/user", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  res.json({ address: req.session.user.sub });
});

// SeagullCoin payment check
app.post("/pay", async (req, res) => {
  const { walletAddress } = req.body;
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();
  const accountInfo = await client.request({ command: "account_lines", account: walletAddress });
  const seagullLine = accountInfo.result.lines.find(line => line.currency === "SeagullCoin" && line.issuer === SGLCN_ISSUER);
  if (!seagullLine || parseFloat(seagullLine.balance) < 0.5) {
    return res.status(400).json({ error: "Insufficient SeagullCoin balance." });
  }
  client.disconnect();
  res.json({ success: true });
});

// Mint NFT
app.post("/mint", upload.single("file"), async (req, res) => {
  const { name, description, domain, collectionName, collectionIcon, properties, walletAddress } = req.body;

  const buffer = fs.readFileSync(req.file.path);
  const type = mime.getType(req.file.originalname);
  const file = new File([buffer], req.file.originalname, { type });
  const metadata = await nftStorage.store({
    name,
    description,
    image: file,
    properties: JSON.parse(properties || "{}"),
    collection: { name: collectionName, icon: collectionIcon },
    domain
  });
  fs.unlinkSync(req.file.path);

  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();
  const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_WALLET_SEED);
  const tx = {
    TransactionType: "NFTokenMint",
    Account: wallet.address,
    URI: xrpl.convertStringToHex(metadata.url),
    Flags: 8,
    TransferFee: 0,
    NFTokenTaxon: 0,
    Memos: [
      {
        Memo: {
          MemoData: xrpl.convertStringToHex("SGLCN Mint"),
          MemoType: xrpl.convertStringToHex("Info")
        }
      }
    ]
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    const tokenId = result.result.meta.nftoken_id;
    const nft = { name, description, image: metadata.data.image.href, tokenId, collection: collectionName };
    mintedNFTs.push(nft);
    if (!collections[collectionName]) {
      collections[collectionName] = { name: collectionName, icon: collectionIcon, nfts: [] };
    }
    collections[collectionName].nfts.push(nft);
    res.json({ success: true, tokenId });
  } else {
    res.status(500).json({ error: "Mint failed" });
  }
  client.disconnect();
});

// Buy NFT (SeagullCoin only)
app.post("/buy-nft", async (req, res) => {
  const { buyerAddress, sellerAddress, tokenId, price } = req.body;
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_WALLET_SEED);
  const tx = {
    TransactionType: "NFTokenCreateOffer",
    Account: buyerAddress,
    Owner: sellerAddress,
    NFTokenID: tokenId,
    Amount: {
      currency: "SeagullCoin",
      issuer: SGLCN_ISSUER,
      value: price.toString()
    },
    Flags: 1
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  client.disconnect();

  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Buy offer failed" });
  }
});

// Get all NFTs and collections
app.get("/nfts", (req, res) => {
  res.json({ mintedNFTs, collections });
});

// Swagger UI route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Root route to confirm the server is live
app.get("/", (req, res) => {
  res.send("SGLCN-X20 Minting API is live. Visit /api-docs for API documentation.");
});

app.listen(PORT, () => {
  console.log(`NFT minting server running on port ${PORT}`);
});
