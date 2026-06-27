const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult, body } = require('express-validator');

// Validation middleware
const validateSignup = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).*$/)
    .withMessage('Password must contain uppercase, lowercase, number, and symbol'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  body('phoneNumber').isMobilePhone(),
  body('fullName').notEmpty(),
  body('address').notEmpty(),
  body('country').notEmpty(),
  body('state').notEmpty()
];

// SIGNUP ROUTE
router.post('/signup', validateSignup, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, phoneNumber, fullName, address, country, state, userType, skills, services, handwork } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate worker-specific fields
    if (userType === 'worker') {
      if (!skills || !services || !handwork) {
        return res.status(400).json({ message: 'Workers must provide skills, services, and handwork information' });
      }
    }

    // Create new user
    user = new User({
      email,
      password,
      phoneNumber,
      fullName,
      address,
      country,
      state,
      userType,
      role: userType
    });

    await user.save();

    // If worker, create worker profile
    if (userType === 'worker') {
      const Worker = require('../models/Worker');
      const workerProfile = new Worker({
        userId: user._id,
        skills,
        services,
        handwork
      });
      await workerProfile.save();
    }

    // Create JWT token
    const payload = {
      userId: user._id,
      userType: user.userType,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        userType: user.userType,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'This account has been banned. Contact support for help.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const payload = {
      userId: user._id,
      userType: user.userType,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        userType: user.userType,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// VERIFY TOKEN ROUTE
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json(decoded);
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
