const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'skill.hub.gtt@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Skillhub24/7';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || 'Skill Hub Admin';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '09015210112';
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || 'Skill Hub HQ';
const ADMIN_COUNTRY = process.env.ADMIN_COUNTRY || 'Nigeria';
const ADMIN_STATE = process.env.ADMIN_STATE || 'Lagos';

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) {
      console.log(`Admin account already exists: ${ADMIN_EMAIL}`);
      process.exit(0);
    }

    const admin = new User({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      phoneNumber: ADMIN_PHONE,
      fullName: ADMIN_FULL_NAME,
      address: ADMIN_ADDRESS,
      country: ADMIN_COUNTRY,
      state: ADMIN_STATE,
      userType: 'customer',
      role: 'admin'
    });

    await admin.save();
    console.log('Admin account created successfully:');
    console.log(`  email: ${ADMIN_EMAIL}`);
    console.log(`  password: ${ADMIN_PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin account:', error);
    process.exit(1);
  }
}

createAdmin();
