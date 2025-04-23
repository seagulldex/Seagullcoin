const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, xrpToDrops } = require('xrpl');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = 3000;

const SEAGULLCOIN_CODE = "SGLCN-X20";
const SEAGULLCOIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const MINT_COST = "0.5";
const SERVICE_WALLET = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";

const xrpl = new Client('wss://s1.ripple.com');

// Home route
app.get('/', (req, res) => {
  res.send('Welcome to the SeagullCoin NFT Minting API');
});

// Swagger definition
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
        "parameters": [{
          "in": "body",
          "name": "wallet",
          "description": "Wallet address of the user making the payment",
          "required": true,
          "schema": {
            "type": "object",
            "properties": {
              "wallet": { "type": "string" }
            }
          }
        }],
        "responses": {
          "200": {
            "description": "Payment verified",
            "schema": {
              "type": "object",
              "properties": {
                "success": { "type": "boolean" },
                "txHash": { "type": "string" }
              }
            }
          },
          "400": { "description": "Invalid request" },
          "402": { "description": "Insufficient balance" },
          "403": { "description": "Payment not found" },
          "500": { "description": "Internal server error" }
        }
      }
    },
    "/mint": {
      "post": {
        "summary": "Mint a SeagullCoin NFT",
        "description": "Mints a new NFT using SeagullCoin as the currency.",
        "parameters": [{
          "in": "body",
          "name": "wallet",
          "required": true,
          "schema": {
            "type": "object",
            "properties": {
              "wallet": { "type": "string" },
              "metadataUri": { "type": "string" }
            }
          }
        }],
        "responses": {
          "200": {
            "description": "NFT minted successfully",
            "schema": {
              "type": "object",
              "properties": {
                "success": { "type": "boolean" },
                "message": { "type": "string" },
                "NFTokenID": { "type": "string" }
              }
            }
          },
          "400": { "description": "Invalid request" },
          "500": { "description": "Internal server error" }
        }
      }
    },
    "/buy-nft": {
      "post": {
        "summary": "Buy an NFT with SeagullCoin",
        "description": "Allows the user to buy an NFT using SeagullCoin.",
        "parameters": [{
          "in": "body",
          "name": "transaction",
          "required": true,
          "schema": {
            "type": "object",
            "properties": {
              "wallet": { "type": "string" },
              "nftId": { "type": "string" },
              "amount": { "type": "string" }
            }
          }
        }],
        "responses": {
          "200": {
            "description": "NFT purchase successful",
            "schema": {
              "type": "object",
              "properties": {
                "success": { "type": "boolean" },
                "message": { "type": "string" }
              }
            }
          },
          "400": { "description": "Invalid request" },
          "500": { "description": "Internal server error" }
        }
      }
    },
    "/sell-nft": {
      "post": {
        "summary": "Sell an NFT for SeagullCoin",
        "description": "List an NFT for sale with SeagullCoin as the price.",
        "parameters": [{
          "in": "body",
          "name": "transaction",
          "required": true,
          "schema": {
            "type": "object",
            "properties": {
              "wallet": { "type": "string" },
              "nftId": { "type": "string" },
              "price": { "type": "string" }
            }
          }
        }],
        "responses": {
          "200": {
            "description": "NFT listed for sale successfully",
            "schema": {
              "type": "object",
              "properties": {
                "success": { "type": "boolean" },
                "message": { "type": "string" }
              }
            }
          },
          "400": { "description": "Invalid request" },
          "500": { "description": "Internal server error" }
        }
      }
    }
  }
};

app.use(cors({ origin: ['https://bidds.com', 'https://xrp.cafe', '*'] }));
app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Start the server
app.listen(port, () => {
  console.log(`SGLCN-X20 API running on port ${port}`);
});
