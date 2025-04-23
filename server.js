const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, xrpToDrops } = require('xrpl');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const SEAGULLCOIN_CODE = "SGLCN-X20";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_COST = "0.5"; // SeagullCoin required for minting
const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";

const xrpl = new Client('wss://s1.ripple.com');

// Define Swagger specification
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
    "/buy-nft": {
      "post": {
        "summary": "Buy an NFT with SeagullCoin",
        "description": "Allows the user to buy an NFT using SeagullCoin.",
        "parameters": [
          {
            "in": "body",
            "name": "transaction",
            "description": "Transaction details for buying an NFT",
            "required": true,
            "schema": {
              "type": "object",
              "properties": {
                "wallet": {
                  "type": "string"
                },
                "nftId": {
                  "type": "string"
                },
                "amount": {
                  "type": "string"
                }
              }
            }
          }
        ],
        "responses": {
          "200": {
            "description": "NFT purchase successful",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                },
                "message": {
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
    "/sell-nft": {
      "post": {
        "summary": "Sell an NFT for SeagullCoin",
        "description": "Allows the user to list an NFT for sale with SeagullCoin as the price.",
        "parameters": [
          {
            "in": "body",
            "name": "transaction",
            "description": "Transaction details for selling an NFT",
            "required": true,
            "schema": {
              "type": "object",
              "properties": {
                "wallet": {
                  "type": "string"
                },
                "nftId": {
                  "type": "string"
                },
                "price": {
                  "type": "string"
                }
              }
            }
          }
        ],
        "responses": {
          "200": {
            "description": "NFT listed for sale successfully",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                },
                "message": {
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
    }
  }
};

app.use(cors({
  origin: ['https://bidds.com', 'https://xrp.cafe', '*']
}));
app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Payment verification: Ensuring SeagullCoin payment
async function verifySeagullCoinPayment(wallet, amount) {
  const accountInfo = await xrpl.request({
    "command": "account_info",
    "account": wallet
  });
  
  const trustline = accountInfo.result.account_data?.Account?.trustlines?.find(t => t.currency === SEAGULLCOIN_CODE && t.issuer === SEAGULLCOIN_ISSUER);
  
  if (!trustline || trustline.balance < amount) {
    throw new Error('Insufficient SeagullCoin balance');
  }
  
  return true;
}

// Mint NFT: Handle minting logic for SeagullCoin
app.post('/mint', async (req, res) => {
  const { wallet, metadataUri } = req.body;

  try {
    await verifySeagullCoinPayment(wallet, MINT_COST);
    
    // Handle NFT creation logic (e.g., interaction with XRPL to mint NFT)
    const newNFTokenID = 'NFT12345'; // This should be generated dynamically with XRPL minting logic
    res.json({
      success: true,
      message: "NFT minted successfully.",
      NFTokenID: newNFTokenID
    });
  } catch (error) {
    res.status(402).json({ success: false, message: error.message });
  }
});

// Buy NFT: Ensure the buyer is paying with SeagullCoin
app.post('/buy-nft', async (req, res) => {
  const { wallet, nftId, amount } = req.body;

  try {
    const price = parseFloat(amount);
    if (price <= 0) throw new Error('Price must be positive');
    
    await verifySeagullCoinPayment(wallet, price);
    
    // Handle NFT buying logic (e.g., transfer NFT)
    res.json({
      success: true,
      message: `NFT ${nftId} bought successfully with ${price} SeagullCoin.`
    });
  } catch (error) {
    res.status(402).json({ success: false, message: error.message });
  }
});

// Sell NFT: Ensure the sale price is in SeagullCoin
app.post('/sell-nft', async (req, res) => {
  const { wallet, nftId, price } = req.body;

  try {
    const salePrice = parseFloat(price);
    if (salePrice <= 0) throw new Error('Sale price must be positive');
    
    // Handle NFT selling logic (e.g., mark NFT for sale)
    res.json({
      success: true,
      message: `NFT ${nftId} listed for sale at ${salePrice} SeagullCoin.`
    });
  } catch (error) {
    res.status(402).json({ success: false, message: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
