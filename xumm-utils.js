import { XummSdk } from 'xumm-sdk'
import dotenv from 'dotenv'
dotenv.config()

const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET)

/**
 * Creates a XUMM payload to sign an NFT offer (buy/sell).
 */
export async function createNftOfferPayload(walletAddress, nftokenID, amount, isSellOffer = true) {
  const payload = {
    txjson: {
      TransactionType: 'NFTokenCreateOffer',
      Account: walletAddress,
      NFTokenID: nftokenID,
      Amount: {
        currency: 'SeagullCoin',
        issuer: process.env.SGLCN_ISSUER,
        value: String(amount)
      },
      Flags: isSellOffer ? 1 : 0
    },
    options: {
      submit: true,
      return_url: {
        app: process.env.XUMM_REDIRECT_URI,
        web: process.env.XUMM_REDIRECT_URI
      }
    }
  }

  const response = await xumm.payload.createAndSubscribe(payload, event => {
    if (event.data.signed === true) {
      return event.data
    }
  })

  return response
}

/**
 * Verifies that the XUMM payload was signed by the user.
 * @param {string} payloadUUID - The UUID of the payload to verify.
 * @returns {object} - The payload verification result.
 */
export async function verifyXummPayload(payloadUUID) {
  try {
    const response = await xumm.payload.get(payloadUUID)

    if (response?.meta?.signed === true) {
      return { success: true, data: response }
    } else {
      throw new Error('Payload was not signed.')
    }
  } catch (error) {
    console.error('Error verifying XUMM payload:', error)
    throw new Error('Failed to verify XUMM payload.')
  }
}

/**
 * Example function to get user info (wallet balance, etc.)
 */
export async function getUserInfo(accessToken) {
  try {
    const response = await fetch('https://xumm.app/api/v1/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user information.')
    }

    const userInfo = await response.json()
    return userInfo
  } catch (error) {
    console.error('Error fetching user info:', error)
    throw new Error('Failed to fetch user info')
  }
}

export { xumm };
