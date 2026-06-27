const express = require('express');
const router = express.Router();
const Opportunity = require('../models/Opportunity');
const Worker = require('../models/Worker');
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
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// CREATE OPPORTUNITY (Customer only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'customer') {
      return res.status(403).json({ message: 'Only customers can create opportunities' });
    }

    const { title, description, skillRequired, country, state, location, budget, deadline, priority } = req.body;

    if (!title || !description || !skillRequired || !country || !state || !location) {
      return res.status(400).json({ message: 'Title, description, skill required, country, state, and location are mandatory' });
    }

    // Find closest available workers and exclude banned workers
    const workers = await Worker.find({ isAvailable: true })
      .populate('userId', 'address country state isBanned');

    // Simple filtering - in production, use geolocation library
    const notifiedWorkers = workers
      .filter(w => w.userId && !w.userId.isBanned)
      .filter(w => 
        w.skills.some(s => s.toLowerCase().includes(skillRequired.toLowerCase())) ||
        w.services.toLowerCase().includes(skillRequired.toLowerCase())
      )
      .slice(0, 10)
      .map(w => w._id);

    const opportunity = new Opportunity({
      customerId: req.userId,
      title,
      description,
      skillRequired,
      country,
      state,
      location,
      budget,
      deadline,
      priority,
      notifiedWorkers
    });

    await opportunity.save();

    // Emit notification event (in real implementation, use Socket.io)
    res.json({
      message: 'Opportunity created and notifications sent',
      opportunity,
      notifiedWorkers: notifiedWorkers.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET ALL OPPORTUNITIES
router.get('/', async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ status: 'open' })
      .populate('customerId', 'fullName phoneNumber address')
      .populate('acceptedBy', 'userId')
      .exec();

    res.json(opportunities);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET OPPORTUNITY BY ID
router.get('/:opportunityId', async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.opportunityId)
      .populate('customerId', 'fullName phoneNumber address email country state')
      .populate('acceptedBy', 'userId');

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    res.json(opportunity);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// WORKER ACCEPT OPPORTUNITY
router.post('/:opportunityId/accept', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can accept opportunities' });
    }

    const opportunity = await Opportunity.findById(req.params.opportunityId);

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    if (opportunity.status !== 'open') {
      return res.status(400).json({ message: 'Opportunity is no longer available' });
    }

    if (opportunity.acceptedBy) {
      return res.status(400).json({ message: 'Opportunity already accepted by another worker' });
    }

    // Get worker profile
    const worker = await Worker.findOne({ userId: req.userId });

    if (!worker) {
      return res.status(404).json({ message: 'Worker profile not found' });
    }

    opportunity.acceptedBy = worker._id;
    opportunity.status = 'in-progress';
    await opportunity.save();

    res.json({
      message: 'Opportunity accepted successfully',
      opportunity
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// COMPLETE OPPORTUNITY
router.put('/:opportunityId/complete', verifyToken, async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.opportunityId);

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    if (req.userType === 'customer' && opportunity.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Only the customer who created this opportunity can mark it complete' });
    }

    opportunity.status = 'completed';
    await opportunity.save();

    // Update worker's completed jobs
    if (opportunity.acceptedBy) {
      await Worker.findByIdAndUpdate(opportunity.acceptedBy, {
        $inc: { completedJobs: 1 }
      });
    }

    res.json({
      message: 'Opportunity marked as completed',
      opportunity
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET OPPORTUNITIES FOR WORKER
router.get('/worker/list', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can view this' });
    }

    const worker = await Worker.findOne({ userId: req.userId });

    if (!worker) {
      return res.status(404).json({ message: 'Worker profile not found' });
    }

    const opportunities = await Opportunity.find({
      notifiedWorkers: worker._id
    }).populate('customerId', 'fullName phoneNumber address email');

    res.json(opportunities);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
