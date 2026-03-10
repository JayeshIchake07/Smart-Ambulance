const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      default: null,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      default: null,
    },
    emergencyType: {
      type: String,
      enum: ['Cardiac', 'Accident', 'Breathing', 'Injury', 'Stroke', 'Unknown'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'dispatched',
        'driver_accepted',
        'en_route_to_victim',
        'patient_picked_up',
        'en_route_to_hospital',
        'completed',
        'cancelled',
      ],
      default: 'pending',
    },
    victimLocation: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    route: {
      // Array of [lat, lng] coordinates from OSRM (ambulance -> victim)
      type: [[Number]],
      default: [],
    },
    routeToHospital: {
      // Array of [lat, lng] coordinates from OSRM (victim -> hospital)
      type: [[Number]],
      default: [],
    },
    eta: {
      type: Number, // minutes
      default: 0,
    },
    hospitalScore: {
      type: Number,
      default: 0,
    },
    needsICU: {
      type: Boolean,
      default: false,
    },
    hospitalReady: {
      type: Boolean,
      default: false,
    },
    pickedUpAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Emergency', emergencySchema);
