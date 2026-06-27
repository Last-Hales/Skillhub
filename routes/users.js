const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userType = decoded.userType;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// GET USER PROFILE
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

const adminOnly = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// UPDATE USER PROFILE
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { fullName, phoneNumber, address, country, state, profileImage } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        fullName,
        phoneNumber,
        address,
        country,
        state,
        profileImage,
        updatedAt: Date.now()
      },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET NEW SIGNUPS (admin only)
router.get('/recent', verifyToken, adminOnly, async (req, res) => {
  try {
    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(recentUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// BAN OR UNBAN A WORKER ACCOUNT (admin only)
router.put('/:userId/ban', verifyToken, adminOnly, async (req, res) => {
  try {
    const { ban } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.userType !== 'worker') {
      return res.status(400).json({ message: 'Only worker accounts can be banned through this route' });
    }
    user.isBanned = ban === true;
    await user.save();
    res.json({ message: `Worker has been ${user.isBanned ? 'banned' : 'unbanned'}.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET USER BY ID
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
