const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, xrpToDrops } = require('xrpl');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Define Swagger specification directly in server.js
const swaggerDocument = {
  "swagger": "2.0",
  "info": {
    "title": "SGLCN-X20 Minting API",
    "description": "API for minting SeagullCoin (SGLCN-X20) NFTs",
    "version": "1.0.0"
  },
  "host": "localhost:3000",
  "schemes": ["http"],
  "paths": {
    "/pay": {
      "post": {
        "summary": "Verify payment of SeagullCoin for minting",
        "description": "Verifies if the user has paid the correct amount of SeagullCoin for minting an NFT.",
        "parameters": [
          {
            "in": "body",
            "name": "wallet",
            "description": "Wallet address of the user making the payment",
            "required": true,
            "schema": {
              "type": "object",
              "properties": {
                "wallet": {
                  "type": "string"
                }
              }
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Payment verified",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                },
                "txHash": {
                  "type": "string"
                }
              }
            }
          },
          "400": {
            "description": "Invalid request"
          },
          "402": {
            "description": "Insufficient balance"
          },
          "403": {
            "description": "Payment not found"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      }
    },
    "/mint": {
      "post": {
        "summary": "Mint a SeagullCoin NFT",
        "description": "Mints a new NFT using SeagullCoin as the currency.",
        "parameters": [
          {
            "in": "body",
            "name": "wallet",
            "description": "Wallet address of the user requesting the mint",
            "required": true,
            "schema": {
              "type": "object",
              "properties": {
                "wallet": {
                  "type": "string"
                },
                "metadataUri": {
                  "type": "string"
                }
              }
            }
          }
        ],
        "responses": {
          "200": {
            "description": "NFT minted successfully",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                },
                "message": {
                  "type": "string"
                },
                "NFTokenID": {
                  "type": "string"
                }
              }
            }
          },
          "400": {
            "description": "Invalid request"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      }
    },
    "/user/{wallet}": {
      "get": {
        "summary": "Get user information",
        "description": "Fetches information about the user such as trustlines and balance.",
        "parameters": [
          {
            "in": "path",
            "name": "wallet",
            "required": true,
            "type": "string",
            "description": "Wallet address of the user"
          }
        ],
        "responses": {
          "200": {
            "description": "User information fetched",
            "schema": {
              "type": "object",
              "properties": {
                "wallet": {
                  "type": "string"
                },
                "trustlines": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "balance": {
                  "type": "string"
                }
              }
            }
          },
          "400": {
            "description": "Invalid wallet address"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      }
    }
  }
};

app.use(cors({
  origin: ['https://bidds.com', 'https://xrp.cafe', '*']
}));
app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve a basic welcome message at the root route
app.get('/', (req, res) => {
  res.send('Welcome to the SGLCN-X20 Minting API! Visit /api-docs for API documentation.');
});

// Payment verification endpoint
app.post('/pay', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

  try {
    const accountInfo = await xrpl.request({
      command: 'account_lines',
      account: wallet
    });

    const trustline = accountInfo.result.lines.find(
      line => line.currency === SEAGULLCOIN_CODE && line.account === SEAGULLCOIN_ISSUER
    );

    if (!trustline || parseFloat(trustline.balance) < parseFloat(MINT_COST)) {
      return res.status(402).json({ error: 'Insufficient SeagullCoin balance' });
    }

    const transactions = await xrpl.request({
      command: 'account_tx',
      account: SERVICE_WALLET,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 20
    });

    const validTx = transactions.result.transactions.find(tx =>
      tx.tx.TransactionType === 'Payment' &&
      tx.tx.Amount.currency === SEAGULLCOIN_CODE &&
      tx.tx.Amount.issuer === SEAGULLCOIN_ISSUER &&
      tx.tx.Amount.value === MINT_COST &&
      tx.tx.Account === wallet
    );

    if (!validTx) {
      return res.status(403).json({ error: 'No valid payment found' });
    }

    res.json({ success: true, txHash: validTx.tx.hash });
  } catch (e) {
    res.status(500).json({ error: 'Error verifying payment', details: e.message });
  }
});

// Mint endpoint (simplified logic for public API)
app.post('/mint', async (req, res) => {
  const { wallet, metadataUri } = req.body;
  if (!wallet || !metadataUri) return res.status(400).json({ error: 'Missing wallet or metadata URI' });

  try {
    // Example mint logic; you can expand this
    // For now, assume mint success and return a placeholder NFTokenID
    res.json({
      success: true,
      message: 'NFT minted (stub)',
      NFTokenID: '00080000F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1'
    });
  } catch (e) {
    res.status(500).json({ error: 'Minting failed', details: e.message });
  }
});

// User info endpoint (stub for now)
app.get('/user/:wallet', async (req, res) => {
  const { wallet } = req.params;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });

  try {
    // Return stub info
    res.json({
      wallet,
      trustlines: ['SeagullCoin'],
      balance: '2.5'
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user info', details: e.message });
  }
});

app.listen(port, () => {
  console.log(`SGLCN-X20 API server running on port ${port}`);
});
