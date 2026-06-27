const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const Worker = require('../models/Worker');
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

// CREATE RATING (Customer rates Worker)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'customer') {
      return res.status(403).json({ message: 'Only customers can rate workers' });
    }

    const { workerId, opportunityId, rating, review } = req.body;

    if (!workerId || !opportunityId || !rating) {
      return res.status(400).json({ message: 'Worker ID, opportunity ID, and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if rating already exists
    let existingRating = await Rating.findOne({ opportunityId });
    if (existingRating) {
      return res.status(400).json({ message: 'This opportunity has already been rated' });
    }

    const newRating = new Rating({
      workerId,
      customerId: req.userId,
      opportunityId,
      rating,
      review
    });

    await newRating.save();

    // Update worker's average rating
    const allRatings = await Rating.find({ workerId });
    const averageRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

    await Worker.findByIdAndUpdate(workerId, {
      rating: averageRating,
      totalRatings: allRatings.length
    });

    res.json({
      message: 'Rating submitted successfully',
      rating: newRating
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET WORKER RATINGS
router.get('/worker/:workerId', async (req, res) => {
  try {
    const ratings = await Rating.find({ workerId: req.params.workerId })
      .populate('customerId', 'fullName profileImage')
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET RATING FOR SPECIFIC OPPORTUNITY
router.get('/opportunity/:opportunityId', async (req, res) => {
  try {
    const rating = await Rating.findOne({ opportunityId: req.params.opportunityId })
      .populate('workerId')
      .populate('customerId', 'fullName profileImage');

    if (!rating) {
      return res.status(404).json({ message: 'No rating found for this opportunity' });
    }

    res.json(rating);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
