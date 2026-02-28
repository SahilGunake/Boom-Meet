const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { ensureAuthenticated } = require('../middleware/ensureAuth');
const { authLimiter } = require('../middleware/rateLimiter');

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, password2 } = req.body;
  const errors = [];

  if (!name || !email || !password || !password2) {
    errors.push({ msg: 'Please enter all fields' });
  }

  if (password !== password2) {
    errors.push({ msg: 'Passwords do not match' });
  }

  if (password && password.length < 6) {
    errors.push({ msg: 'Password must be at least 6 characters' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'Email is already registered' }],
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await User.create({ name, email, password: hashedPassword });

    res.json({ success: true, msg: 'Registration successful. Please log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, errors: [{ msg: 'Server error' }] });
  }
});

// @route   POST /api/auth/login
// @desc    Login user & create session
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        errors: [{ msg: info?.message || 'Invalid credentials' }],
      });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email },
      });
    });
  })(req, res, next);
});

// @route   POST /api/auth/logout
// @desc    Logout user & destroy session
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, msg: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, msg: 'Session destroy failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, msg: 'Logged out successfully' });
    });
  });
});

// @route   GET /api/auth/user
// @desc    Get current authenticated user
router.get('/user', ensureAuthenticated, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user.id, name: req.user.name, email: req.user.email },
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Send password-reset email with token link
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, errors: [{ msg: 'Please provide your email' }] });
  }

  try {
    const user = await User.findByEmail(email);

    // Always respond with success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, msg: 'If that email is registered, a reset link has been sent.' });
    }

    // Generate a secure token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    await User.setResetToken(user.id, token, expiry);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password/${token}`;

    await sendEmail({
      to: email,
      subject: 'Boom Meet – Password Reset',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset for your Boom Meet account.</p>
        <p>Click the link below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });

    res.json({ success: true, msg: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ success: false, errors: [{ msg: 'Server error' }] });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using the token
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password, password2 } = req.body;
  const errors = [];

  if (!token || !password || !password2) {
    errors.push({ msg: 'Please fill in all fields' });
  }

  if (password !== password2) {
    errors.push({ msg: 'Passwords do not match' });
  }

  if (password && password.length < 6) {
    errors.push({ msg: 'Password must be at least 6 characters' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const user = await User.findByResetToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'Reset link is invalid or has expired' }],
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await User.updatePassword(user.id, hashedPassword);

    res.json({ success: true, msg: 'Password has been reset. You can now log in.' });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ success: false, errors: [{ msg: 'Server error' }] });
  }
});

module.exports = router;
