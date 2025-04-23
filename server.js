import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { NFTStorage, File } from 'nft.storage';
import { Xumm } from 'xumm';
import xrpl from 'xrpl';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGINS.split(','),
  credentials: true
}));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const xumm = new Xumm(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
const client = new xrpl.Client("wss://xrplcluster.com");

const SERVICE_WALLET = process.env.SERVICE_WALLET;
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;
const SGLCN_CURRENCY_HEX = process.env.SGLCN_CURRENCY_HEX;
const MINT_FEE = 0.5;

app.post('/pay', async (req, res) => {
  const { wallet } = req.body;

  try {
    const payload = await xumm.payload.create({
      TransactionType: 'Payment',
      Destination: SERVICE_WALLET,
      Amount: {
        currency: SGLCN_CURRENCY_HEX,
        issuer: SGLCN_ISSUER,
        value: MINT_FEE.toString()
      }
    });

    res.json({
      uuid: payload.uuid,
      next: payload.next.always
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/mint', upload.single('file'), async (req, res) => {
  const { wallet, name, description, domain } = req.body;
  const file = req.file;

  if (!wallet || !file) {
    return res.status(400).json({ error: 'Missing wallet or file' });
  }

  await client.connect();

  try {
    // Check payment
    const accountTx = await client.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1,
      ledger_index_max: -1,
      binary: false,
      limit: 20
    });

    const paid = accountTx.result.transactions.some(tx =>
      tx.tx.TransactionType === 'Payment' &&
      tx.tx.Destination === SERVICE_WALLET &&
      tx.tx.Amount?.currency === SGLCN_CURRENCY_HEX &&
      tx.tx.Amount?.issuer === SGLCN_ISSUER &&
      parseFloat(tx.tx.Amount?.value) >= MINT_FEE
    );

    if (!paid) {
      return res.status(402).json({ error: 'No SeagullCoin payment found' });
    }

    // Upload to IPFS
    const fileData = await fs.promises.readFile(file.path);
    const ipfsFile = new File([fileData], file.originalname, { type: file.mimetype });

    const metadata = await nftStorage.store({
      name,
      description,
      image: ipfsFile,
      properties: { domain: domain || '', creator: wallet }
    });

    // Mint NFT
    const tx = await client.autofill({
      TransactionType: 'NFTokenMint',
      Account: SERVICE_WALLET,
      URI: xrpl.convertStringToHex(metadata.url),
      Flags: 8,
      TransferFee: 0,
      NFTokenTaxon: 0
    });

    const walletInstance = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SECRET);
    const signed = walletInstance.sign(tx);
    const result = await client.submitAndWait(signed.tx_blob);

    const nftokenId = result.result.meta?.nftoken_id || 'Unknown';

    res.json({
      success: true,
      metadata: metadata.url,
      nftokenId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.disconnect();
    fs.unlink(file.path, () => {});
  }
});

app.listen(3000, () => console.log("SGLCN-X20 Minting API running on port 3000"));
