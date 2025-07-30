// authMiddleware.js
export function basicAuth(req, res, next) {
  const auth = req.headers.authorization;

  // Expected format: Basic base64(username:password)
  const expected = 'Basic ' + Buffer.from(
  `${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`
).toString('base64');

  if (auth !== expected) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }

  next();
}
