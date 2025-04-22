{
  "swagger": "2.0",
  "info": {
    "title": "SGLCN-X20 Minting API",
    "version": "1.0.0",
    "description": "This API allows minting of NFTs using SeagullCoin (SGLCN-X20)."
  },
  "paths": {
    "/mint": {
      "post": {
        "summary": "Mint an NFT",
        "description": "Mint an NFT by uploading an image and providing metadata.",
        "parameters": [
          {
            "name": "file",
            "in": "formData",
            "description": "The file to upload (image for NFT)",
            "required": true,
            "type": "file"
          },
          {
            "name": "name",
            "in": "formData",
            "description": "Name of the NFT",
            "required": true,
            "type": "string"
          },
          {
            "name": "description",
            "in": "formData",
            "description": "Description of the NFT",
            "required": true,
            "type": "string"
          },
          {
            "name": "domain",
            "in": "formData",
            "description": "Domain of the NFT creator",
            "required": true,
            "type": "string"
          },
          {
            "name": "collectionName",
            "in": "formData",
            "description": "Collection name for the NFT",
            "required": true,
            "type": "string"
          },
          {
            "name": "collectionIcon",
            "in": "formData",
            "description": "Icon for the NFT collection",
            "required": true,
            "type": "string"
          },
          {
            "name": "properties",
            "in": "formData",
            "description": "Additional properties of the NFT",
            "required": false,
            "type": "string"
          }
        ],
        "responses": {
          "200": {
            "description": "NFT minted successfully",
            "schema": {
              "type": "object",
              "properties": {
                "success": { "type": "boolean" },
                "tokenId": { "type": "string" }
              }
            }
          },
          "500": {
            "description": "Minting failed"
          }
        }
      }
    },
    "/nfts": {
      "get": {
        "summary": "Get all minted NFTs and collections",
        "description": "Returns all minted NFTs and their collections.",
        "responses": {
          "200": {
            "description": "List of NFTs and collections",
            "schema": {
              "type": "object",
              "properties": {
                "mintedNFTs": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string" },
                      "description": { "type": "string" },
                      "image": { "type": "string" },
                      "tokenId": { "type": "string" },
                      "collection": { "type": "string" }
                    }
                  }
                },
                "collections": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string" },
                      "icon": { "type": "string" },
                      "nfts": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "name": { "type": "string" },
                            "description": { "type": "string" },
                            "image": { "type": "string" },
                            "tokenId": { "type": "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
