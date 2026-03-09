const Emergency = require('./models/Emergency');
const Ambulance = require('./models/Ambulance');

// Map: userId → socketId
const userSockets = {};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Register user ──────────────────────────────────────────────────────
    socket.on('register', ({ userId, role }) => {
      userSockets[userId] = socket.id;
      socket.userId = userId;
      socket.role = role;
      socket.join(role); // join role room
      socket.join(`user-${userId}`); // join personal room
      console.log(`👤 Registered: ${userId} as ${role} → ${socket.id}`);
    });

    // ── Driver accepts emergency ───────────────────────────────────────────
    socket.on('driver-accepted', async ({ emergencyId }) => {
      try {
        const emergency = await Emergency.findById(emergencyId)
          .populate('ambulance')
          .populate('hospital');

        if (!emergency) return;

        emergency.status = 'driver_accepted';
        await emergency.save();

        // Tell victim ambulance is coming
        io.to(`user-${emergency.patient.toString()}`).emit('ambulance-coming', {
          emergencyId,
          eta: emergency.eta,
          ambulance: {
            vehicle: emergency.ambulance.vehicle,
            type: emergency.ambulance.type,
          },
          hospital: {
            name: emergency.hospital.name,
            address: emergency.hospital.address,
            score: emergency.hospital.score,
          },
          message: 'Ambulance is on the way!',
        });

        console.log(`✅ Driver accepted emergency: ${emergencyId}`);
      } catch (err) {
        console.error('driver-accepted error:', err.message);
      }
    });

    // ── Driver sends live location ─────────────────────────────────────────
    socket.on('driver-location', async ({ lat, lng, emergencyId }) => {
      try {
        const emergency = await Emergency.findById(emergencyId);
        if (!emergency) return;

        // Update ambulance location in DB
        await Ambulance.findByIdAndUpdate(emergency.ambulance, {
          'location.lat': lat,
          'location.lng': lng,
        });

        // Calculate rough ETA (simplified)
        const eta = emergency.eta > 0 ? emergency.eta - 1 : 0;
        emergency.eta = eta;
        await emergency.save();

        // Broadcast to victim
        io.to(`user-${emergency.patient.toString()}`).emit('ambulance-location', {
          lat,
          lng,
          eta,
          emergencyId,
        });
      } catch (err) {
        console.error('driver-location error:', err.message);
      }
    });

    // ── Patient picked up ──────────────────────────────────────────────────
    socket.on('patient-picked-up', async ({ emergencyId }) => {
      try {
        const emergency = await Emergency.findById(emergencyId)
          .populate('hospital')
          .populate('ambulance');

        if (!emergency) return;

        emergency.status = 'patient_picked_up';
        emergency.pickedUpAt = new Date();
        await emergency.save();

        // Notify victim
        io.to(`user-${emergency.patient.toString()}`).emit('status-update', {
          emergencyId,
          status: 'patient_picked_up',
          message: '🚑 You\'ve been picked up! Heading to hospital...',
          hospital: {
            name: emergency.hospital.name,
            address: emergency.hospital.address,
          },
        });

        // Notify hospital
        io.to('hospital').emit('patient-arrived', {
          emergencyId,
          patientType: emergency.emergencyType,
          ambulanceETA: emergency.eta,
          ambulanceLocation: {
            lat: emergency.ambulance.location.lat,
            lng: emergency.ambulance.location.lng,
          },
          hospitalId: emergency.hospital._id,
        });

        console.log(`🏥 Patient picked up for emergency: ${emergencyId}`);
      } catch (err) {
        console.error('patient-picked-up error:', err.message);
      }
    });

    // ── Patient delivered ──────────────────────────────────────────────────
    socket.on('patient-delivered', async ({ emergencyId }) => {
      try {
        const emergency = await Emergency.findById(emergencyId).populate('ambulance');
        if (!emergency) return;

        emergency.status = 'completed';
        emergency.completedAt = new Date();
        await emergency.save();

        // Free up ambulance
        await Ambulance.findByIdAndUpdate(emergency.ambulance._id, {
          status: 'available',
          currentEmergency: null,
        });

        // Tell victim help is complete
        io.to(`user-${emergency.patient.toString()}`).emit('help-complete', {
          emergencyId,
          message: 'You have received help. Stay safe!',
          completedAt: emergency.completedAt,
        });

        console.log(`✅ Emergency completed: ${emergencyId}`);
      } catch (err) {
        console.error('patient-delivered error:', err.message);
      }
    });

    // ── Hospital marks ready ───────────────────────────────────────────────
    socket.on('hospital-ready', async ({ emergencyId }) => {
      try {
        const emergency = await Emergency.findById(emergencyId).populate('ambulance');
        if (!emergency) return;

        emergency.hospitalReady = true;
        await emergency.save();

        // Notify driver
        if (emergency.ambulance && emergency.ambulance.driver) {
          io.to(`user-${emergency.ambulance.driver.toString()}`).emit(
            'hospital-confirmed-ready',
            {
              emergencyId,
              message: 'Hospital is ready to receive patient',
            }
          );
        }

        console.log(`🏥 Hospital ready for emergency: ${emergencyId}`);
      } catch (err) {
        console.error('hospital-ready error:', err.message);
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.userId) {
        delete userSockets[socket.userId];
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports.userSockets = userSockets;
