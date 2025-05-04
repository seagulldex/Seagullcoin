// middleware.js

export function requireLogin(req, res, next) {
    // Assuming you store the user address in session or a cookie
    if (req.session && req.session.userAddress) {
        // If the user is logged in, attach the user address to the request
        req.userAddress = req.session.userAddress;
        return next();  // Proceed to the next middleware or route handler
    } else {
        // If the user is not logged in, return a 401 Unauthorized error
        return res.status(401).json({ error: 'User not logged in' });
    }
}
