const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema(
  {
    vehicle: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['ALS', 'BLS', 'ICU'],
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'dispatched', 'busy', 'offline'],
      default: 'available',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    driverName: {
      type: String,
      default: 'Driver',
    },
    currentEmergency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Emergency',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ambulance', ambulanceSchema);
