// middleware.js

/**
 * Middleware to ensure the user is logged in via XUMM.
 * Verifies that a wallet address exists in session.
 */
export function requireLogin(req, res, next) {
  if (!req.session?.walletAddress) {
    return res.status(401).json({ error: 'Please login first' })
  }
  next()
}
