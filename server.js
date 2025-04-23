const express = require("express");
const cors = require("cors");
const xrpl = require("xrpl");
const { NFTStorage, File } = require("nft.storage");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { XummSdk } = require("xumm-sdk");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
const xumm = new XummSdk(process.env.XUMM_API_KEY);

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;
const SGLCN_CURRENCY = "53656167756C6C436F696E000000000000000000"; // "SeagullCoin" in hex
const MINT_COST = "0.5";

const upload = multer({ dest: "uploads/" });

// Endpoint to upload file and metadata to NFT.Storage
app.post("/mint", upload.single("file"), async (req, res) => {
  try {
    const { name, description, domain, properties, collection } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send("No file uploaded.");

    const metadata = {
      name,
      description,
      image: new File([fs.readFileSync(file.path)], file.originalname, {
        type: file.mimetype,
      }),
      properties: JSON.parse(properties || "{}"),
      domain,
      collection: JSON.parse(collection || "{}"),
    };

    const metadataCID = await nftStorage.store(metadata);

    fs.unlinkSync(file.path); // Clean up temp file

    res.json({
      success: true,
      cid: metadataCID.ipnft,
      uri: `ipfs://${metadataCID.ipnft}/metadata.json`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Minting failed.");
  }
});

// Endpoint to start XUMM payment for mint
app.post("/pay", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).send("Wallet address required.");

    const payload = {
      TransactionType: "Payment",
      Destination: SERVICE_WALLET,
      Amount: {
        currency: SGLCN_CURRENCY,
        issuer: SGLCN_ISSUER,
        value: MINT_COST,
      },
    };

    const xummPayload = await xumm.payload.createAndSubscribe(payload, e => {
      if (e.signed === false) {
        res.status(400).json({ success: false, reason: "Payment rejected." });
      }
    });

    res.json({
      success: true,
      uuid: xummPayload.uuid,
      next: xummPayload.next,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Payment initiation failed.");
  }
});

// Public API to fetch all stored NFTs (stub for now)
app.get("/nfts", async (req, res) => {
  // Replace with actual DB or storage list logic later
  res.json({ nfts: [] });
});

// XUMM user auth info
app.get("/user/:token", async (req, res) => {
  try {
    const result = await xumm.payload.get(req.params.token);
    res.json({ account: result.response.account });
  } catch (e) {
    res.status(400).send("Invalid token.");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`SGLCN-X20-API running on https://${process.env.PROJECT_DOMAIN || "localhost"}:${PORT}`);
});
