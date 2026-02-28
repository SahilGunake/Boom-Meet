const express = require('express');
const router = express.Router();
const { v4: uuidV4 } = require('uuid');
const { ensureAuthenticated } = require('../middleware/ensureAuth');

// @route   GET /api/meetings/new
// @desc    Create a new meeting room and return the room ID
router.get('/new', ensureAuthenticated, (req, res) => {
  const roomId = uuidV4();
  res.json({ success: true, roomId });
});

module.exports = router;
