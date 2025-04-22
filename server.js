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

const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

const SEAGULLCOIN_HEX = "53656167756C6C436F696E000000000000000000";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_PRICE = 0.5;
const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";

app.use(cors({
  origin: ["https://bidds.com", "https://xrp.cafe"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "sglcn-secret", resave: false, saveUninitialized: true }));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(express.static("public"));

// In-memory storage (for demo)
let mintedNFTs = [];
let collections = {};

app.get("/login", async (req, res) => {
  const payload = await xumm.authorize();
  res.redirect(payload.auth_url);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");

  try {
    const loginData = await xumm.oauth2Token(code);
    req.session.wallet = loginData.me.account;
    res.send("Login successful! Wallet: " + loginData.me.account);
  } catch (err) {
    res.status(500).send("Login error: " + err.message);
  }
});

app.post("/pay", async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).send("Missing wallet address");

  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  try {
    const accountInfo = await client.request({
      command: "account_lines",
      account: walletAddress
    });

    const seagullLine = accountInfo.result.lines.find(
      (line) => line.currency === SEAGULLCOIN_HEX && line.account === SEAGULLCOIN_ISSUER
    );

    if (seagullLine && parseFloat(seagullLine.balance) >= MINT_PRICE) {
      res.send({ success: true });
    } else {
      res.status(400).send("Insufficient SeagullCoin balance.");
    }
  } catch (err) {
    res.status(500).send("XRPL error: " + err.message);
  } finally {
    client.disconnect();
  }
});

app.post("/mint", upload.single("file"), async (req, res) => {
  const {
    name, description, domain, collectionName, collectionIcon, properties, walletAddress
  } = req.body;

  if (!req.file || !name || !description || !domain || !walletAddress) {
    return res.status(400).send("Missing required fields.");
  }

  try {
    const filePath = path.join(__dirname, req.file.path);
    const content = await fs.promises.readFile(filePath);
    const nftFile = new File([content], req.file.originalname, {
      type: mime.getType(req.file.originalname)
    });

    const metadata = {
      name,
      description,
      image: nftFile,
      properties: JSON.parse(properties || "{}"),
      domain,
      collection: collectionName || null,
      collectionIcon: collectionIcon || null
    };

    const stored = await nftStorage.store(metadata);
    const uriHex = Buffer.from(`ipfs://${stored.ipnft}`).toString("hex").toUpperCase();

    const client = new xrpl.Client("wss://xrplcluster.com");
    await client.connect();

    const wallet = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED);

    const tx = {
      TransactionType: "NFTokenMint",
      Account: wallet.classicAddress,
      URI: uriHex,
      Flags: 8,
      NFTokenTaxon: 0
    };

    const submit = await client.submitAndWait(tx, { wallet });

    const tokenId = submit.result.meta?.nftoken_id || "minted"; // fallback

    mintedNFTs.push({ success: true, tokenId });
    if (collectionName) {
      collections[collectionName] = collections[collectionName] || [];
      collections[collectionName].push({ name, tokenId });
    }

    fs.unlinkSync(filePath);
    client.disconnect();

    res.send({ success: true, tokenId });
  } catch (err) {
    console.error("Mint error:", err);
    res.status(500).send("Minting failed: " + err.message);
  }
});

app.get("/nfts", (req, res) => {
  res.send({ mintedNFTs, collections });
});

app.post("/buy-nft", async (req, res) => {
  const { buyerAddress, sellerAddress, tokenId, price } = req.body;
  if (!buyerAddress || !sellerAddress || !tokenId || !price) {
    return res.status(400).send("Missing required fields.");
  }

  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();
  try {
    const wallet = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED);

    const tx = {
      TransactionType: "Payment",
      Account: buyerAddress,
      Destination: sellerAddress,
      Amount: {
        currency: SEAGULLCOIN_HEX,
        value: price.toString(),
        issuer: SEAGULLCOIN_ISSUER
      }
    };

    const submit = await client.submitAndWait(tx, { wallet });

    client.disconnect();
    res.send({ success: true, txHash: submit.result.hash });
  } catch (err) {
    client.disconnect();
    res.status(500).send("Purchase failed: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`SGLCN-X20 API running on port ${PORT}`);
});
