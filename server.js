const express = require("express");
const multer = require("multer");
const xrpl = require("xrpl");
const { NFTStorage, File } = require("nft.storage");
const mime = require("mime");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: "uploads/" });

app.use(express.json());

app.use(require("cors")({
  origin: [
    "https://bidds.com",
    "https://xrp.cafe",
    "https://sglcn.art",
    "https://outgoing-destiny-bladder.glitch.me"
  ],
  credentials: false
}));

const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";
const S