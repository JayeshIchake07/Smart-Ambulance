require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Ambulance = require('./models/Ambulance');
const Hospital = require('./models/Hospital');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ── Clear existing data ───────────────────────────────────────────────
    await User.deleteMany({});
    await Ambulance.deleteMany({});
    await Hospital.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // ── Seed Hospitals ─────────────────────────────────────────────────────
    const hospitals = await Hospital.insertMany([
      {
        name: 'Lilavati Hospital',
        address: 'A-791, Bandra Reclamation, Bandra West, Mumbai',
        location: { lat: 19.0544, lng: 72.8322 },
        availableBeds: 15,
        totalBeds: 60,
        specialists: ['cardiac', 'neuro', 'ortho'],
        phone: '+91-22-2675-1000',
      },
      {
        name: 'KEM Hospital',
        address: 'Acharya Donde Marg, Parel, Mumbai',
        location: { lat: 19.0012, lng: 72.8405 },
        availableBeds: 32,
        totalBeds: 120,
        specialists: ['cardiac', 'trauma', 'general'],
        phone: '+91-22-2410-7000',
      },
      {
        name: 'Bombay Hospital',
        address: '12, New Marine Lines, Mumbai',
        location: { lat: 18.9338, lng: 72.826 },
        availableBeds: 8,
        totalBeds: 40,
        specialists: ['ortho', 'general'],
        phone: '+91-22-2206-7676',
      },
      {
        name: 'Nanavati Hospital',
        address: 'S.V. Road, Vile Parle West, Mumbai',
        location: { lat: 19.099, lng: 72.8387 },
        availableBeds: 20,
        totalBeds: 80,
        specialists: ['cardiac', 'neuro', 'trauma', 'ortho'],
        phone: '+91-22-2626-7500',
      },
    ]);
    console.log(`🏥 Seeded ${hospitals.length} hospitals`);

    // ── Seed Ambulances ───────────────────────────────────────────────────
    const ambulances = await Ambulance.insertMany([
      {
        vehicle: 'MH-01-AM-001',
        type: 'ALS',
        location: { lat: 19.0544, lng: 72.8322 }, // Bandra
        status: 'available',
        driverName: 'Rajesh Kumar',
      },
      {
        vehicle: 'MH-01-AM-002',
        type: 'ICU',
        location: { lat: 19.1136, lng: 72.8697 }, // Andheri
        status: 'available',
        driverName: 'Suresh Patil',
      },
      {
        vehicle: 'MH-01-AM-003',
        type: 'BLS',
        location: { lat: 19.0178, lng: 72.8478 }, // Dadar
        status: 'available',
        driverName: 'Anil Sharma',
      },
      {
        vehicle: 'MH-01-AM-004',
        type: 'ICU',
        location: { lat: 18.9067, lng: 72.8147 }, // Colaba
        status: 'available',
        driverName: 'Pradeep Singh',
      },
      {
        vehicle: 'MH-01-AM-005',
        type: 'ALS',
        location: { lat: 19.1215, lng: 72.905 }, // Powai
        status: 'available',
        driverName: 'Vijay Rao',
      },
    ]);
    console.log(`🚑 Seeded ${ambulances.length} ambulances`);

    // ── Seed Test Users ───────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Victim user
    const victimUser = await User.create({
      name: 'Test Victim',
      email: 'victim@test.com',
      password: hashedPassword,
      role: 'victim',
      phone: '+91-9999999999',
    });

    // Driver users — link to ambulances
    const driver1 = await User.create({
      name: 'Rajesh Kumar',
      email: 'driver1@test.com',
      password: hashedPassword,
      role: 'driver',
      phone: '+91-9876543210',
      ambulanceId: ambulances[0]._id,
    });

    const driver2 = await User.create({
      name: 'Suresh Patil',
      email: 'driver2@test.com',
      password: hashedPassword,
      role: 'driver',
      phone: '+91-9876543211',
      ambulanceId: ambulances[1]._id,
    });

    // Link drivers back to ambulances
    await Ambulance.findByIdAndUpdate(ambulances[0]._id, { driver: driver1._id });
    await Ambulance.findByIdAndUpdate(ambulances[1]._id, { driver: driver2._id });

    // Hospital staff user
    const hospitalUser = await User.create({
      name: 'Hospital Admin',
      email: 'hospital@test.com',
      password: hashedPassword,
      role: 'hospital',
      phone: '+91-9876543212',
      hospitalId: hospitals[0]._id,
    });

    console.log(`👥 Seeded test users:`);
    console.log(`   Victim:   victim@test.com   / 123456`);
    console.log(`   Driver 1: driver1@test.com  / 123456  (MH-01-AM-001 ALS)`);
    console.log(`   Driver 2: driver2@test.com  / 123456  (MH-01-AM-002 ICU)`);
    console.log(`   Hospital: hospital@test.com / 123456  (Lilavati)`);

    console.log('\n✅ Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
};

seed();
