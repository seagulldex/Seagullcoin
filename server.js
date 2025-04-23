const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { NFTStorage, File } = require("nft.storage");
const { RippleAPI } = require("ripple-lib");
const mime = require("mime-types");

require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });
const port = 3000;

const NFT_STORAGE_KEY = process.env.NFT_STORAGE_KEY;
const SERVICE_WALLET = process.env.SERVICE_WALLET;
const api = new RippleAPI({ server: "wss://xrplcluster.com" });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "SGLCN-X20 Minting API is live." });
});

// Serve mint.html from the root directory
app.get("/mint.html", (req, res) => {
  res.sendFile(path.join(__dirname, "mint.html"));
});

app.post("/mint", upload.single("file"), async (req, res) => {
  try {
    const { name, description, collection } = req.body;
    const file = req.file;

    if (!name || !description || !file) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, description, or file.",
      });
    }

    const fileData = fs.readFileSync(file.path);
    const nftFile = new File(
      [fileData],
      file.originalname,
      { type: mime.lookup(file.originalname) || "application/octet-stream" }
    );

    const nftStorage = new NFTStorage({ token: NFT_STORAGE_KEY });

    const metadata = await nftStorage.store({
      name,
      description,
      image: nftFile,
      properties: {
        collection: collection || "Uncategorized",
      },
    });

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Return metadata for now
    return res.json({
      success: true,
      metadata: metadata.url,
    });
  } catch (err) {
    console.error("Minting error:", err);
    res.status(500).json({
      success: false,
      error: "Error minting NFT. Please try again later.",
    });
  }
});

app.listen(port, () => {
  console.log(`SGLCN-X20 API running on port ${port}`);
});
