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
        address: 'A-791, Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050',
        location: { lat: 19.0515, lng: 72.8292 },
        availableBeds: 24,
        totalBeds: 323,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-2675-1000',
        isActive: true,
      },
      {
        name: 'KEM Hospital',
        address: 'Acharya Donde Marg, Parel, Mumbai, Maharashtra 400012',
        location: { lat: 19.0019, lng: 72.8411 },
        availableBeds: 38,
        totalBeds: 390,
        specialists: ['cardiac', 'neuro', 'ortho', 'trauma', 'general'],
        phone: '+91-22-2410-7000',
        isActive: true,
      },
      {
        name: 'Bombay Hospital',
        address: '12, New Marine Lines, Mumbai, Maharashtra 400020',
        location: { lat: 18.9402, lng: 72.8258 },
        availableBeds: 19,
        totalBeds: 220,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-2206-7676',
        isActive: true,
      },
      {
        name: 'Nanavati Hospital',
        address: 'S.V. Road, Vile Parle West, Mumbai, Maharashtra 400056',
        location: { lat: 19.0954, lng: 72.8400 },
        availableBeds: 27,
        totalBeds: 350,
        specialists: ['cardiac', 'neuro', 'ortho', 'trauma', 'general'],
        phone: '+91-22-2626-7500',
        isActive: true,
      },
      {
        name: 'Hinduja Hospital - Mahim',
        address: 'Veer Savarkar Marg, Mahim West, Mumbai, Maharashtra 400016',
        location: { lat: 19.0419, lng: 72.8406 },
        availableBeds: 22,
        totalBeds: 240,
        specialists: ['cardiac', 'neuro', 'trauma', 'general'],
        phone: '+91-22-2445-2222',
        isActive: true,
      },
      {
        name: 'Breach Candy Hospital - Breach Candy',
        address: '60A, Bhulabhai Desai Road, Breach Candy, Mumbai, Maharashtra 400026',
        location: { lat: 18.9726, lng: 72.8065 },
        availableBeds: 16,
        totalBeds: 180,
        specialists: ['cardiac', 'general'],
        phone: '+91-22-2367-2888',
        isActive: true,
      },
      {
        name: 'Jaslok Hospital - Pedder Road',
        address: '15, Dr G Deshmukh Marg, Pedder Road, Mumbai, Maharashtra 400026',
        location: { lat: 18.9718, lng: 72.8093 },
        availableBeds: 21,
        totalBeds: 275,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-6657-3333',
        isActive: true,
      },
      {
        name: 'Kokilaben Dhirubhai Ambani Hospital - Andheri West',
        address: 'Rao Saheb Achutrao Patwardhan Marg, Four Bungalows, Andheri West, Mumbai, Maharashtra 400053',
        location: { lat: 19.1313, lng: 72.8254 },
        availableBeds: 30,
        totalBeds: 500,
        specialists: ['cardiac', 'neuro', 'ortho', 'trauma', 'general'],
        phone: '+91-22-4269-6969',
        isActive: true,
      },
      {
        name: 'Hiranandani Hospital - Powai',
        address: 'Hill Side Avenue, Hiranandani Gardens, Powai, Mumbai, Maharashtra 400076',
        location: { lat: 19.1177, lng: 72.9073 },
        availableBeds: 18,
        totalBeds: 220,
        specialists: ['ortho', 'neuro', 'general'],
        phone: '+91-22-2576-3300',
        isActive: true,
      },
      {
        name: 'Fortis Hiranandani Hospital - Vashi, Navi Mumbai',
        address: 'Plot No. 28, Juhu Nagar, Sector 10A, Vashi, Navi Mumbai, Maharashtra 400703',
        location: { lat: 19.0824, lng: 72.9992 },
        availableBeds: 20,
        totalBeds: 180,
        specialists: ['cardiac', 'trauma', 'general'],
        phone: '+91-22-3919-9222',
        isActive: true,
      },
      {
        name: 'Apollo Hospital - Navi Mumbai',
        address: 'Plot 13, Parsik Hill Road, Sector 23, CBD Belapur, Navi Mumbai, Maharashtra 400614',
        location: { lat: 19.0100, lng: 73.0344 },
        availableBeds: 26,
        totalBeds: 250,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-3350-3350',
        isActive: true,
      },
      {
        name: 'MGM Hospital - Vashi, Navi Mumbai',
        address: 'Sector 3, Vashi, Navi Mumbai, Maharashtra 400703',
        location: { lat: 19.0754, lng: 73.0153 },
        availableBeds: 17,
        totalBeds: 220,
        specialists: ['trauma', 'ortho', 'general'],
        phone: '+91-22-6152-6666',
        isActive: true,
      },
      {
        name: 'Tata Memorial Hospital - Parel',
        address: 'Dr E Borges Road, Parel, Mumbai, Maharashtra 400012',
        location: { lat: 19.0031, lng: 72.8426 },
        availableBeds: 14,
        totalBeds: 440,
        specialists: ['general'],
        phone: '+91-22-2417-7000',
        isActive: true,
      },
      {
        name: 'Wockhardt Hospital - Mumbai Central',
        address: '1877, Dr Anand Rao Nair Road, Mumbai Central, Mumbai, Maharashtra 400011',
        location: { lat: 18.9683, lng: 72.8202 },
        availableBeds: 18,
        totalBeds: 350,
        specialists: ['cardiac', 'general'],
        phone: '+91-22-6178-4444',
        isActive: true,
      },
      {
        name: 'Sir HN Reliance Foundation Hospital - Girgaon',
        address: 'Raja Rammohan Roy Road, Prarthana Samaj, Girgaon, Mumbai, Maharashtra 400004',
        location: { lat: 18.9597, lng: 72.8197 },
        availableBeds: 28,
        totalBeds: 345,
        specialists: ['cardiac', 'neuro', 'general'],
        phone: '+91-22-6130-5000',
        isActive: true,
      },
      {
        name: 'Lilavati Hospital and Research Centre - Bandra West',
        address: 'A-791, Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050',
        location: { lat: 19.0512, lng: 72.8290 },
        availableBeds: 23,
        totalBeds: 314,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-2675-1000',
        isActive: true,
      },
      {
        name: 'Global Hospitals Parel - Parel',
        address: '35, Dr E Borges Road, Hospital Avenue, Parel, Mumbai, Maharashtra 400012',
        location: { lat: 19.0054, lng: 72.8409 },
        availableBeds: 20,
        totalBeds: 250,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-6767-0101',
        isActive: true,
      },
      {
        name: 'Saifee Hospital - Charni Road',
        address: '15/17, Maharshi Karve Road, Charni Road, Mumbai, Maharashtra 400004',
        location: { lat: 18.9549, lng: 72.8177 },
        availableBeds: 15,
        totalBeds: 257,
        specialists: ['cardiac', 'neuro', 'general'],
        phone: '+91-22-6757-0111',
        isActive: true,
      },
      {
        name: 'Holy Family Hospital - Bandra',
        address: 'St Andrews Road, Bandra West, Mumbai, Maharashtra 400050',
        location: { lat: 19.0508, lng: 72.8265 },
        availableBeds: 18,
        totalBeds: 268,
        specialists: ['cardiac', 'ortho', 'general'],
        phone: '+91-22-3061-0555',
        isActive: true,
      },
      {
        name: 'Criticare Hospital - Andheri West',
        address: 'Building No 1, Kirol Road, Andheri West, Mumbai, Maharashtra 400053',
        location: { lat: 19.1361, lng: 72.8337 },
        availableBeds: 12,
        totalBeds: 140,
        specialists: ['cardiac', 'trauma', 'general'],
        phone: '+91-22-6775-6666',
        isActive: true,
      },
      {
        name: 'Cooper Hospital - Juhu',
        address: 'Juhu Tara Road, JVPD Scheme, Juhu, Mumbai, Maharashtra 400056',
        location: { lat: 19.1075, lng: 72.8353 },
        availableBeds: 34,
        totalBeds: 420,
        specialists: ['trauma', 'ortho', 'general'],
        phone: '+91-22-2620-7256',
        isActive: true,
      },
      {
        name: 'Lokmanya Tilak Municipal General Hospital - Sion',
        address: 'Dr Babasaheb Ambedkar Road, Sion West, Mumbai, Maharashtra 400022',
        location: { lat: 19.0434, lng: 72.8611 },
        availableBeds: 36,
        totalBeds: 425,
        specialists: ['cardiac', 'neuro', 'trauma', 'general'],
        phone: '+91-22-2407-6381',
        isActive: true,
      },
      {
        name: 'Jupiter Hospital - Thane',
        address: 'Eastern Express Highway, Service Road, Thane West, Maharashtra 400601',
        location: { lat: 19.2053, lng: 72.9712 },
        availableBeds: 25,
        totalBeds: 300,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-2172-5555',
        isActive: true,
      },
      {
        name: 'Bethany Hospital - Thane',
        address: 'Pokhran Road No. 2, Thane West, Maharashtra 400610',
        location: { lat: 19.1977, lng: 72.9720 },
        availableBeds: 16,
        totalBeds: 180,
        specialists: ['cardiac', 'ortho', 'general'],
        phone: '+91-22-2172-5100',
        isActive: true,
      },
      {
        name: 'Reliance Hospital - Koparkhairane',
        address: 'Thane Belapur Road, Koparkhairane, Navi Mumbai, Maharashtra 400709',
        location: { lat: 19.1033, lng: 73.0074 },
        availableBeds: 22,
        totalBeds: 200,
        specialists: ['cardiac', 'neuro', 'general'],
        phone: '+91-22-3966-6666',
        isActive: true,
      },
      {
        name: 'Terna Sahyadri Hospital - Nerul',
        address: 'Plot No. 12, Sector 22, Nerul West, Navi Mumbai, Maharashtra 400706',
        location: { lat: 19.0456, lng: 73.0217 },
        availableBeds: 14,
        totalBeds: 160,
        specialists: ['cardiac', 'ortho', 'general'],
        phone: '+91-22-6157-8300',
        isActive: true,
      },
      {
        name: 'Godrej Memorial Hospital - Vikhroli',
        address: 'Pirojshanagar, Vikhroli East, Mumbai, Maharashtra 400079',
        location: { lat: 19.1035, lng: 72.9225 },
        availableBeds: 13,
        totalBeds: 150,
        specialists: ['cardiac', 'general'],
        phone: '+91-22-6641-7100',
        isActive: true,
      },
      {
        name: 'Rajawadi Hospital - Ghatkopar',
        address: 'Rajawadi Road No. 7, Ghatkopar East, Mumbai, Maharashtra 400077',
        location: { lat: 19.0805, lng: 72.9084 },
        availableBeds: 28,
        totalBeds: 360,
        specialists: ['trauma', 'ortho', 'general'],
        phone: '+91-22-2102-8000',
        isActive: true,
      },
      {
        name: 'MGM Hospital Kamothe - Kamothe',
        address: 'Sector 1A, Kamothe, Navi Mumbai, Maharashtra 410209',
        location: { lat: 19.0180, lng: 73.0963 },
        availableBeds: 18,
        totalBeds: 200,
        specialists: ['trauma', 'ortho', 'general'],
        phone: '+91-22-2743-7900',
        isActive: true,
      },
      {
        name: 'Fortis Hospital Mulund - Mulund',
        address: 'Mulund Goregaon Link Road, Mulund West, Mumbai, Maharashtra 400078',
        location: { lat: 19.1720, lng: 72.9559 },
        availableBeds: 24,
        totalBeds: 315,
        specialists: ['cardiac', 'neuro', 'ortho', 'general'],
        phone: '+91-22-6799-4444',
        isActive: true,
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
