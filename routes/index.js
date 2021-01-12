/* This one contains all code for authorized and unauthorized routes */

const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');

// Landing Page
router.get('/', forwardAuthenticated, (req, res) => res.render('landing'));

// Dashboard
router.get('/dashboard', ensureAuthenticated, (req, res) =>
  res.render('dashboard', {
    user: req.user
  })
);

module.exports = router;
