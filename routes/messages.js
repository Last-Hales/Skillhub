const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
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
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// SEND MESSAGE
router.post('/', verifyToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

    const conversationId = [req.userId, receiverId].sort().join('-');

    const message = new Message({
      senderId: req.userId,
      receiverId,
      content,
      conversationId
    });

    await message.save();

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET CONVERSATION
router.get('/conversation/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const conversationId = [req.userId, userId].sort().join('-');

    const messages = await Message.find({ conversationId })
      .populate('senderId', 'fullName profileImage')
      .populate('receiverId', 'fullName profileImage')
      .sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET ALL CONVERSATIONS
router.get('/', verifyToken, async (req, res) => {
  try {
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: req.userId },
            { receiverId: req.userId }
          ]
        }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $last: '$content' },
          lastTimestamp: { $last: '$timestamp' },
          otherUserId: {
            $last: {
              $cond: [
                { $eq: ['$senderId', req.userId] },
                '$receiverId',
                '$senderId'
              ]
            }
          }
        }
      },
      { $sort: { lastTimestamp: -1 } }
    ]);

    // Populate user details
    const conversationsWithDetails = await Promise.all(
      messages.map(async (msg) => {
        const User = require('../models/User');
        const otherUser = await User.findById(msg.otherUserId).select('fullName email profileImage');
        return {
          ...msg,
          otherUser
        };
      })
    );

    res.json(conversationsWithDetails);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// MARK MESSAGE AS READ
router.put('/:messageId/read', verifyToken, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { isRead: true },
      { new: true }
    );

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
