import express from 'express'
import dotenv from 'dotenv'
import { NFTStorage, File } from 'nft.storage'
import { XummSdk } from 'xumm-sdk'
import xrpl from 'xrpl'
import fetch from 'node-fetch'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Init
dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000
const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY })
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET)
const upload = multer({ dest: 'uploads/' })

app.use(express.json())

// Helper for file path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

// Home route
app.get('/', (req, res) => {
  res.json({ message: 'SGLCN-X20 Minting API is live.' })
})

// Mint route
app.post('/mint', upload.single('file'), async (req, res) => {
  try {
    const { name, description, collection } = req.body
    const filePath = req.file?.path

    if (!name || !description || !filePath) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, or file.',
      })
    }

    const fileData = await fs.promises.readFile(filePath)
    const nftFile = new File([fileData], req.file.originalname, {
      type: req.file.mimetype,
    })

    const metadata = await client.store({
      name,
      description,
      image: nftFile,
      properties: {
        collection,
      },
    })

    // XRPL Mint Transaction Payload
    const txJson = {
      TransactionType: 'NFTokenMint',
      Account: process.env.XUMM_ACCOUNT,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 0,
      TransferFee: 0,
      NFTokenTaxon: 0,
    }

    const payload = await xumm.payload.create({ txjson: txJson })

    // Cleanup uploaded file
    fs.unlink(filePath, () => {})

    res.json({
      success: true,
      message: 'NFT mint payload created.',
      payload_url: payload.next.always,
      metadata_url: metadata.url,
    })
  } catch (err) {
    console.error('Minting error:', err)
    res.status(500).json({
      success: false,
      error: 'Error minting NFT. Please try again later.',
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`SGLCN-X20 API running on port ${PORT}`)
})
