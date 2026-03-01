const express = require('express');
const router = express.Router();
const { v4: uuidV4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { ensureAuthenticated } = require('../middleware/ensureAuth');
const Meeting = require('../models/Meeting');

// @route   POST /api/meetings/new
// @desc    Create a new meeting room (optionally with title & password)
router.post('/new', ensureAuthenticated, async (req, res) => {
  try {
    const { title, password } = req.body || {};
    const roomId = uuidV4();

    let hashedPassword = null;
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
    }

    const meeting = await Meeting.create({
      roomId,
      hostId: req.user.id,
      hostName: req.user.name,
      title: title || 'Untitled Meeting',
      password: hashedPassword,
    });

    res.json({ success: true, roomId: meeting.roomId, hasPassword: !!hashedPassword });
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ success: false, errors: [{ msg: 'Server error' }] });
  }
});

// @route   GET /api/meetings/:roomId/info
// @desc    Get meeting info (used by client to check if password is required)
router.get('/:roomId/info', ensureAuthenticated, async (req, res) => {
  try {
    const meeting = await Meeting.findByRoomId(req.params.roomId);
    if (!meeting) {
      // No meeting doc → ad-hoc room with no password
      return res.json({ success: true, exists: false, hasPassword: false });
    }
    res.json({
      success: true,
      exists: true,
      hasPassword: !!meeting.password,
      title: meeting.title,
      hostName: meeting.hostName,
      isActive: meeting.isActive,
    });
  } catch (err) {
    console.error('Meeting info error:', err);
    res.status(500).json({ success: false, errors: [{ msg: 'Server error' }] });
  }
});

// @route   POST /api/meetings/:roomId/verify-password
// @desc    Verify meeting password before joining
router.post('/:roomId/verify-password', ensureAuthenticated, async (req, res) => {
  try {
    const meeting = await Meeting.findByRoomId(req.params.roomId);
    if (!meeting || !meeting.password) {
      return res.json({ success: true, allowed: true });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, errors: [{ msg: 'Password is required for this meeting' }] });
    }

    const isMatch = await bcrypt.compare(password, meeting.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, errors: [{ msg: 'Incorrect meeting password' }] });
    }

    res.json({ success: true, allowed: true });
  } catch (err) {
    console.error('Verify password error:', err);
    res.status(500).json({ success: false, errors: [{ msg: 'Server error' }] });
  }
});

// @route   GET /api/meetings/ice-servers
// @desc    Return ICE (STUN + TURN) config so credentials stay server-side
router.get('/ice-servers', ensureAuthenticated, (req, res) => {
  const turnUrl = process.env.TURN_SERVER_URL || '';
  const turnUser = process.env.TURN_USERNAME || '';
  const turnCred = process.env.TURN_CREDENTIAL || '';

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (turnUrl && turnUser && turnCred) {
    iceServers.push(
      { urls: `turn:${turnUrl}:80`, username: turnUser, credential: turnCred },
      { urls: `turn:${turnUrl}:80?transport=tcp`, username: turnUser, credential: turnCred },
      { urls: `turn:${turnUrl}:443`, username: turnUser, credential: turnCred },
      { urls: `turns:${turnUrl}:443?transport=tcp`, username: turnUser, credential: turnCred }
    );
  }

  res.json({ success: true, iceServers });
});

module.exports = router;
