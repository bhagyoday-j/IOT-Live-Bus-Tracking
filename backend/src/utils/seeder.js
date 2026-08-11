const mongoose = require('mongoose');
const config = require('../config/index');
const User = require('../models/User');
const Depot = require('../models/Depot');
const Stop = require('../models/Stop');
const Route = require('../models/Route');
const Driver = require('../models/Driver');
const Bus = require('../models/Bus');
const logger = require('../utils/logger');

const seedUsers = [
  {
    name: 'Test User',
    email: 'test@test.com',
    password: '123456',
    role: 'passenger',
    phone: '+1234567890',
  },
  {
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'Admin123',
    role: 'admin',
    phone: '+1234567891',
  },
  {
    name: 'Depot Manager',
    email: 'manager@test.com',
    password: 'Manager123',
    role: 'depot_manager',
    phone: '+1234567892',
  },
];

// ── Demo dataset (Nashik, Maharashtra) ──────────────────────────────
const seedDepots = [
  {
    name: 'Nashik Central Depot',
    code: 'NSK01',
    location: { type: 'Point', coordinates: [73.7898, 19.9975] },
    address: { street: 'College Road', city: 'Nashik', state: 'Maharashtra', pincode: '422005' },
    phone: '+91 98220 00001',
    email: 'central@smarttransit.ai',
    capacity: { total: 60, current: 5 },
    facilities: ['maintenance-bay', 'fuel-station', 'parking', 'office'],
  },
  {
    name: 'Ambad Depot',
    code: 'NSK02',
    location: { type: 'Point', coordinates: [73.745, 19.965] },
    address: { street: 'Ambad MIDC', city: 'Nashik', state: 'Maharashtra', pincode: '422010' },
    phone: '+91 98220 00002',
    email: 'ambad@smarttransit.ai',
    capacity: { total: 40, current: 2 },
    facilities: ['charging-station', 'parking', 'canteen'],
  },
];

const seedStops = [
  { name: 'Central Bus Stand', code: 'NSK-CBS', location: { type: 'Point', coordinates: [73.7898, 19.9975] }, amenities: ['shelter', 'bench', 'display-board', 'ticket-machine'] },
  { name: 'College Road', code: 'NSK-CLR', location: { type: 'Point', coordinates: [73.7900, 19.9840] }, amenities: ['shelter', 'bench', 'lighting'] },
  { name: 'Nashik Road Station', code: 'NSK-NRS', location: { type: 'Point', coordinates: [73.8020, 19.9610] }, amenities: ['shelter', 'bench', 'cctv', 'wheelchair-access'] },
  { name: 'Dwarka', code: 'NSK-DWR', location: { type: 'Point', coordinates: [73.7740, 19.9700] }, amenities: ['shelter', 'bench'] },
  { name: 'Gangapur Road', code: 'NSK-GPR', location: { type: 'Point', coordinates: [73.7680, 19.9880] }, amenities: ['shelter', 'bench', 'lighting'] },
  { name: 'Ambad MIDC', code: 'NSK-AMB', location: { type: 'Point', coordinates: [73.7450, 19.9650] }, amenities: ['shelter', 'bench', 'cctv'] },
];

const seedDrivers = [
  { name: 'Rahul Patil', phone: '+91 90000 00001', email: 'rahul@smarttransit.ai', license: { number: 'MH12DRV0001', expiryDate: '2027-06-30', type: 'PSV' }, experience: 8 },
  { name: 'Suresh Jadhav', phone: '+91 90000 00002', email: 'suresh@smarttransit.ai', license: { number: 'MH12DRV0002', expiryDate: '2026-11-15', type: 'PSV' }, experience: 12 },
  { name: 'Vikas More', phone: '+91 90000 00003', email: 'vikas@smarttransit.ai', license: { number: 'MH12DRV0003', expiryDate: '2028-01-20', type: 'PSV' }, experience: 5 },
  { name: 'Amit Kale', phone: '+91 90000 00004', email: 'amit@smarttransit.ai', license: { number: 'MH12DRV0004', expiryDate: '2026-09-10', type: 'HTV' }, experience: 10 },
];

const seedBuses = [
  { number: 'MH-12-AB-1001', deviceId: 'BUS_MH001', deviceSecret: 'bus_secret_123', capacity: 45, busType: 'standard', routeKey: '101', driverKey: 'Rahul Patil', status: 'on-route', lat: 19.9975, lng: 73.7898, speed: 34, heading: 130 },
  { number: 'MH-12-AB-1002', deviceId: 'BUS_MH002', deviceSecret: 'bus_secret_123', capacity: 40, busType: 'standard', routeKey: '101', driverKey: 'Suresh Jadhav', status: 'on-route', lat: 19.984, lng: 73.79, speed: 22, heading: 185 },
  { number: 'MH-12-AB-1003', deviceId: 'BUS_MH003', deviceSecret: 'bus_secret_123', capacity: 50, busType: 'standard', routeKey: '202', driverKey: 'Vikas More', status: 'on-route', lat: 19.988, lng: 73.768, speed: 41, heading: 90 },
  { number: 'MH-12-AB-1004', deviceId: 'BUS_MH004', deviceSecret: 'bus_secret_123', capacity: 40, busType: 'mini', routeKey: '202', driverKey: 'Amit Kale', status: 'idle', lat: 19.961, lng: 73.802, speed: 0, heading: 0 },
  { number: 'MH-12-AB-1005', deviceId: 'BUS_MH005', deviceSecret: 'bus_secret_123', capacity: 35, busType: 'mini', routeKey: null, driverKey: null, status: 'maintenance', lat: null, lng: null, speed: 0, heading: 0 },
];

const connectDatabase = async () => {
  await mongoose.connect(config.mongodb.uri, {
    ...config.mongodb.options,
    maxPoolSize: 50,
    minPoolSize: 10,
  });
};

const seed = async () => {
  await connectDatabase();
  logger.info('Connected to MongoDB for seeding');

  // ── Users ────────────────────────────────────────────────────────
  for (const userData of seedUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      logger.info(`User already exists: ${userData.email}`);
      continue;
    }
    await User.create(userData);
    logger.info(`Seeded user: ${userData.email} (${userData.role})`);
  }

  // ── Depots ───────────────────────────────────────────────────────
  const depots = [];
  for (const depotData of seedDepots) {
    let depot = await Depot.findOne({ code: depotData.code });
    if (!depot) {
      depot = await Depot.create(depotData);
      logger.info(`Seeded depot: ${depotData.code}`);
    }
    depots.push(depot);
  }

  // Attach the depot manager to the first depot (scope their access)
  if (depots.length > 0) {
    await User.findOneAndUpdate(
      { email: 'manager@test.com' },
      { $set: { depotId: depots[0]._id } },
      { new: true }
    );
  }

  // ── Stops ────────────────────────────────────────────────────────
  const stops = [];
  for (const stopData of seedStops) {
    let stop = await Stop.findOne({ code: stopData.code });
    if (!stop) {
      stop = await Stop.create(stopData);
      logger.info(`Seeded stop: ${stopData.code}`);
    }
    stops.push(stop);
  }

  // ── Routes ───────────────────────────────────────────────────────
  const routes = [];
  const routeDefs = [
    {
      number: '101',
      name: 'City Center – Ambad',
      source: 'Central Bus Stand',
      destination: 'Ambad MIDC',
      stopCodes: ['NSK-CBS', 'NSK-CLR', 'NSK-NRS', 'NSK-DWR', 'NSK-GPR', 'NSK-AMB'],
      distances: [0, 1.2, 3.4, 5.1, 7.8, 12.5],
      totalDistance: 12.5,
      totalDuration: 42,
      baseFare: 10,
      geometry: [[73.7898, 19.9975], [73.79, 19.984], [73.802, 19.961], [73.774, 19.97], [73.768, 19.988], [73.745, 19.965]],
    },
    {
      number: '202',
      name: 'College Road – Gangapur Road',
      source: 'College Road',
      destination: 'Gangapur Road',
      stopCodes: ['NSK-CLR', 'NSK-NRS', 'NSK-DWR', 'NSK-GPR'],
      distances: [0, 2.2, 3.1, 8.2],
      totalDistance: 8.2,
      totalDuration: 28,
      baseFare: 8,
      geometry: [[73.79, 19.984], [73.802, 19.961], [73.774, 19.97], [73.768, 19.988]],
    },
  ];

  for (const def of routeDefs) {
    let route = await Route.findOne({ number: def.number });
    if (!route) {
      const routeStops = def.stopCodes.map((code, index) => {
        const stop = stops.find((s) => s.code === code);
        return {
          stopId: stop._id,
          name: stop.name,
          order: index,
          distanceFromStart: def.distances[index],
          etaFromStart: Math.round((def.distances[index] / 25) * 60),
        };
      });

      route = await Route.create({
        name: def.name,
        number: def.number,
        source: def.source,
        destination: def.destination,
        stops: routeStops,
        totalDistance: def.totalDistance,
        totalDuration: def.totalDuration,
        baseFare: def.baseFare,
        depotId: depots[0]._id,
        direction: 'up',
        geometry: { type: 'LineString', coordinates: def.geometry },
        schedule: [
          { departure: '06:00', arrival: '06:42' },
          { departure: '07:30', arrival: '08:12' },
          { departure: '09:00', arrival: '09:42' },
          { departure: '12:00', arrival: '12:42' },
          { departure: '15:30', arrival: '16:12' },
          { departure: '18:00', arrival: '18:42' },
          { departure: '20:00', arrival: '20:42' },
        ],
      });
      logger.info(`Seeded route: ${def.number}`);
    }
    routes.push(route);
  }

  // ── Drivers ──────────────────────────────────────────────────────
  const drivers = [];
  for (const driverData of seedDrivers) {
    let driver = await Driver.findOne({ 'license.number': driverData.license.number });
    if (!driver) {
      driver = await Driver.create({
        ...driverData,
        assignedDepotId: depots[0]._id,
        status: 'on-duty',
      });
      logger.info(`Seeded driver: ${driverData.name}`);
    }
    drivers.push(driver);
  }

  // ── Buses ────────────────────────────────────────────────────────
  for (const busData of seedBuses) {
    let bus = await Bus.findOne({ number: busData.number });
    if (!bus) {
      const route = routes.find((r) => r.number === busData.routeKey) || null;
      const driver = drivers.find((d) => d.name === busData.driverKey) || null;

      bus = await Bus.create({
        number: busData.number,
        deviceId: busData.deviceId,
        deviceSecret: busData.deviceSecret,
        capacity: busData.capacity,
        busType: busData.busType,
        routeId: route?._id || null,
        driverId: driver?._id || null,
        depotId: depots[0]._id,
        status: busData.status,
        currentLocation: busData.lat != null ? {
          lat: busData.lat,
          lng: busData.lng,
          speed: busData.speed,
          heading: busData.heading,
          updatedAt: new Date(),
        } : undefined,
      });

      if (route && !route.assignedBuses.includes(bus._id)) {
        await Route.findByIdAndUpdate(route._id, { $push: { assignedBuses: bus._id } });
      }
      if (driver) {
        const onDuty = busData.status === 'on-route' || busData.status === 'delayed';
        await Driver.findByIdAndUpdate(driver._id, {
          currentBusId: bus._id,
          status: onDuty ? 'on-duty' : 'off-duty',
        });
      }
      logger.info(`Seeded bus: ${busData.number}`);
    }
  }

  // ── Depot stats refresh ──────────────────────────────────────────
  for (const depot of depots) {
    const [totalBuses, activeBuses, totalDrivers, totalRoutes] = await Promise.all([
      Bus.countDocuments({ depotId: depot._id, isActive: true }),
      Bus.countDocuments({ depotId: depot._id, isActive: true, status: 'on-route' }),
      Driver.countDocuments({ assignedDepotId: depot._id, isActive: true }),
      Route.countDocuments({ depotId: depot._id, isActive: true }),
    ]);
    await Depot.findByIdAndUpdate(depot._id, {
      $set: {
        'capacity.current': totalBuses,
        stats: { totalBuses, activeBuses, totalDrivers, totalRoutes },
      },
    });
  }

  const counts = {
    users: await User.countDocuments(),
    depots: await Depot.countDocuments(),
    stops: await Stop.countDocuments(),
    routes: await Route.countDocuments(),
    drivers: await Driver.countDocuments(),
    buses: await Bus.countDocuments(),
  };
  logger.info(`Seeding complete. ${JSON.stringify(counts)}`);
};

seed()
  .then(() => {
    logger.info('Seeder finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Seeder failed:', error);
    process.exit(1);
  });
