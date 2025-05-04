import pkg from 'xumm-oauth2-pkce';
const { XummOauth2Jwt } = pkg;

// ...rest of your code


const xumm = new XummOauth2Jwt({
  clientId: process.env.XUMM_CLIENT_ID,
  clientSecret: process.env.XUMM_CLIENT_SECRET,
  redirectUri: process.env.XUMM_REDIRECT_URI
});

// Middleware to check login
export function requireLogin(req, res, next) {
  if (!req.session?.xummJwt?.me) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }
  next();
}

// Get user info
export function getUser(req) {
  return req.session?.xummJwt?.me;
}

// Logout handler
export function logout(req, res) {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
}

// OAuth2 callback handler
export async function xummCallbackHandler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/login');

  try {
    const jwt = await xumm.getJwtToken(code);
    const user = await xumm.getUserInfo(jwt);

    req.session.xummJwt = {
      jwt,
      me: user,
    };

    res.redirect('/'); // or wherever you'd like
  } catch (err) {
    console.error('OAuth2 error:', err);
    res.status(500).send('Authentication failed.');
  }
}
