const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: 'Mumbai, Maharashtra',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    availableBeds: {
      type: Number,
      default: 10,
    },
    totalBeds: {
      type: Number,
      default: 50,
    },
    specialists: {
      type: [String],
      // e.g. ['cardiac', 'neuro', 'ortho', 'trauma', 'general']
      default: ['general'],
    },
    phone: {
      type: String,
      default: '1800-RAPIDAID',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);
