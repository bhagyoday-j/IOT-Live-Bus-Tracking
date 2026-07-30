const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',

  mongodb: {
    uri: process.env.MONGODB_URI || process.env.MONGODB_URI_ATLAS || 'mongodb://localhost:27017/smarttransit',
    options: {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-me',
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID || 'smarttransit-backend',
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'bus',
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    qos: 1,
    clean: false,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetries: 10,
  },

  firebase: {
    projectId: process.env.FCM_PROJECT_ID,
    privateKeyPath: process.env.FCM_PRIVATE_KEY_PATH,
  },

  osrm: {
    baseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
    timeout: parseInt(process.env.OSRM_TIMEOUT, 10) || 5000,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  deviceAuth: {
    secretSalt: process.env.DEVICE_SECRET_SALT || 'device-salt',
  },
};

module.exports = config;
