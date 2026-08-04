const mongoose = require('mongoose');
const path = require('path');
const config = require('../config/index');
const User = require('../models/User');
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

  for (const userData of seedUsers) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      logger.info(`User already exists: ${userData.email}`);
      continue;
    }

    await User.create(userData);
    logger.info(`Seeded user: ${userData.email} (${userData.role})`);
  }

  const count = await User.countDocuments();
  logger.info(`Seeding complete. Total users: ${count}`);
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
