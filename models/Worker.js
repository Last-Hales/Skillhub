const mongoose = require('mongoose');

const WorkerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skills: [
    {
      type: String,
      required: true
    }
  ],
  services: {
    type: String,
    required: true
  },
  handwork: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  bio: {
    type: String
  },
  certificateUrl: {
    type: String
  },
  yearsOfExperience: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Worker', WorkerSchema);
