import { XummSdk } from 'xumm-sdk'
import dotenv from 'dotenv'
dotenv.config()

const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET)

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
        web: process.env.XUMM_REDIRECT_URI,
        app: process.env.XUMM_REDIRECT_URI
      }
    }
  }

  const { created, resolved } = await xumm.payload.createAndSubscribe(payload, event => {
    if (event.data.signed === true) return event.data
  })

  return {
    uuid: created.uuid,
    next: created.next,
    signed: resolved?.signed
  }
}
