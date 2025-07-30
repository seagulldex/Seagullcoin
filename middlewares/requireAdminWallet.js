const ADMIN_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';

function requireAdminWallet(req, res, next) {
  if (req.session?.user?.account === ADMIN_WALLET) {
    return next();
  }
  res.status(403).json({ error: 'Unauthorized wallet' });
}

export default requireAdminWallet;
