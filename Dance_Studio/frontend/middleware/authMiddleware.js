// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
// The path must correctly point to your User model
const User = require('../models/User'); 

// Middleware to protect routes
const protect = async (req, res, next) => {
    let token;

    // 1. Check if the Authorization header is present and starts with 'Bearer'
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header: "Bearer <token>" -> split at space, take index 1
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify token using your secret key from .env
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Find the user by the ID stored in the token (excluding the password field, but including all others like 'progress')
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                // Token was valid, but user not found in DB
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // Move to the next route handler function
            next();

        } catch (error) {
            console.error(error);
            // This catches expired tokens, invalid secrets, malformed tokens, etc.
            return res.status(401).json({ message: 'Not authorized, token failed or expired' });
        }
    }

    if (!token) {
        // This catches requests that did not have a token in the Authorization header
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };