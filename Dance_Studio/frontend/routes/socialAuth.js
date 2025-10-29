const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// 🔹 Step 1: Start Google Login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 🔹 Step 2: Handle Google Callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:8000/login.html?error=google_fail',
  }),
  (req, res) => {
    const token = generateToken(req.user._id);
    res.redirect(`http://localhost:8000/home1.html?token=${token}`);
  }
);

module.exports = router;
