const express = require('express');
const router = express.Router();
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

// GET ALL AVAILABLE WORKERS
router.get('/', async (req, res) => {
  try {
    const { skill, location, isAvailable } = req.query;

    let filter = {};
    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    }

    let workers = await Worker.find(filter)
      .populate('userId', 'fullName email phoneNumber address country state profileImage isBanned')
      .exec();

    // Remove banned workers from the list
    workers = workers.filter(w => w.userId && !w.userId.isBanned);

    // Filter by skill if provided
    if (skill) {
      workers = workers.filter(w => 
        w.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
      );
    }

    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET WORKER BY ID
router.get('/:workerId', async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.workerId)
      .populate('userId', 'fullName email phoneNumber address country state profileImage isBanned');

    if (!worker || (worker.userId && worker.userId.isBanned)) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE WORKER AVAILABILITY
router.put('/:workerId/availability', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can update availability' });
    }

    const { isAvailable } = req.body;
    const worker = await Worker.findByIdAndUpdate(
      req.params.workerId,
      { isAvailable },
      { new: true }
    ).populate('userId', 'fullName email phoneNumber address country state');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET WORKER PROFILE BY USER ID
router.get('/user/:userId', async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.params.userId })
      .populate('userId', 'fullName email phoneNumber address country state profileImage');

    if (!worker) {
      return res.status(404).json({ message: 'Worker profile not found' });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE WORKER PROFILE
router.put('/:workerId/profile', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can update profile' });
    }

    const { skills, services, handwork, bio, latitude, longitude, yearsOfExperience } = req.body;

    const worker = await Worker.findByIdAndUpdate(
      req.params.workerId,
      {
        skills,
        services,
        handwork,
        bio,
        latitude,
        longitude,
        yearsOfExperience
      },
      { new: true }
    ).populate('userId', 'fullName email phoneNumber address country state');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// SEARCH WORKERS BY SKILL AND LOCATION
router.get('/search', async (req, res) => {
  try {
    const { skill, location, maxDistance } = req.query;

    let filters = { isAvailable: true };
    let workers = await Worker.find(filters)
      .populate('userId', 'fullName email phoneNumber address country state profileImage isBanned')
      .exec();

    // Remove banned workers from the search results
    workers = workers.filter(w => w.userId && !w.userId.isBanned);

    // Filter by skill
    if (skill) {
      workers = workers.filter(w => 
        w.skills.some(s => s.toLowerCase().includes(skill.toLowerCase())) ||
        w.services.toLowerCase().includes(skill.toLowerCase()) ||
        w.handwork.toLowerCase().includes(skill.toLowerCase())
      );
    }

    // Filter by location (simple string matching on user address)
    if (location) {
      workers = workers.filter(w => 
        w.userId.address.toLowerCase().includes(location.toLowerCase()) ||
        w.userId.state.toLowerCase().includes(location.toLowerCase()) ||
        w.userId.country.toLowerCase().includes(location.toLowerCase())
      );
    }

    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
