const config = require('./index');
const logger = require('../utils/logger');

/**
 * MQTT Configuration for EMQX Broker
 * 
 * Topics:
 *   bus/location/{deviceId}   - GPS location updates from IoT devices
 *   bus/status/{deviceId}     - Status updates (online/offline/sos)
 *   bus/telemetry/{deviceId}  - Sensor telemetry (temp/voltage/current/IMU)
 *   bus/command/{deviceId}    - Commands to devices
 */
const mqttConfig = {
  brokerUrl: config.mqtt.brokerUrl,
  options: {
    clientId: `${config.mqtt.clientId}-${Date.now()}`,
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: config.mqtt.reconnectPeriod || 5000,
    connectTimeout: config.mqtt.connectTimeout || 30000,
    clean: config.mqtt.clean !== undefined ? config.mqtt.clean : false,
    qos: config.mqtt.qos || 1,
    rejectUnauthorized: true,
    will: {
      topic: `${config.mqtt.topicPrefix}/status/backend`,
      payload: JSON.stringify({ status: 'offline', timestamp: Date.now() }),
      qos: 1,
      retain: true,
    },
  },
  topics: {
    location: `${config.mqtt.topicPrefix}/location/+`,
    status: `${config.mqtt.topicPrefix}/status/+`,
    telemetry: `${config.mqtt.topicPrefix}/telemetry/+`,
    command: `${config.mqtt.topicPrefix}/command/`,
    alert: `${config.mqtt.topicPrefix}/alert/`,
  },
  subscriptions: [
    { topic: `${config.mqtt.topicPrefix}/location/+`, qos: 1 },
    { topic: `${config.mqtt.topicPrefix}/status/+`, qos: 1 },
    { topic: `${config.mqtt.topicPrefix}/telemetry/+`, qos: 1 },
    { topic: `${config.mqtt.topicPrefix}/alert/+`, qos: 1 },
  ],
  qosLevels: {
    AT_MOST_ONCE: 0,
    AT_LEAST_ONCE: 1,
    EXACTLY_ONCE: 2,
  },
};

/**
 * Validate device payload structure
 */
const validateDevicePayload = (payload) => {
  const errors = [];

  if (!payload.deviceId || typeof payload.deviceId !== 'string') {
    errors.push('deviceId is required and must be a string');
  }
  if (payload.lat === undefined || typeof payload.lat !== 'number' || payload.lat < -90 || payload.lat > 90) {
    errors.push('lat is required and must be a number between -90 and 90');
  }
  if (payload.lng === undefined || typeof payload.lng !== 'number' || payload.lng < -180 || payload.lng > 180) {
    errors.push('lng is required and must be a number between -180 and 180');
  }
  if (payload.speed !== undefined && (typeof payload.speed !== 'number' || payload.speed < 0 || payload.speed > 200)) {
    errors.push('speed must be a number between 0 and 200');
  }
  if (payload.heading !== undefined && (typeof payload.heading !== 'number' || payload.heading < 0 || payload.heading > 360)) {
    errors.push('heading must be a number between 0 and 360');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate a telemetry payload (sensor readings)
 */
const validateTelemetryPayload = (payload) => {
  const errors = [];

  if (!payload.deviceId || typeof payload.deviceId !== 'string') {
    errors.push('deviceId is required and must be a string');
  }
  if (payload.engineTemperature !== undefined && typeof payload.engineTemperature !== 'number') {
    errors.push('engineTemperature must be a number');
  }
  if (payload.batteryVoltage !== undefined && typeof payload.batteryVoltage !== 'number') {
    errors.push('batteryVoltage must be a number');
  }
  if (payload.currentDraw !== undefined && typeof payload.currentDraw !== 'number') {
    errors.push('currentDraw must be a number');
  }
  if (payload.vibration !== undefined && typeof payload.vibration !== 'number') {
    errors.push('vibration must be a number');
  }

  const hasSensorData = payload.engineTemperature !== undefined
    || payload.batteryVoltage !== undefined
    || payload.currentDraw !== undefined
    || payload.vibration !== undefined
    || (payload.accelerometer && typeof payload.accelerometer === 'object')
    || (payload.gyroscope && typeof payload.gyroscope === 'object');

  if (!hasSensorData) {
    errors.push('payload must contain at least one sensor reading');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Get the device ID from a topic string
 * e.g., 'bus/location/BUS_MH001' -> 'BUS_MH001'
 */
const extractDeviceIdFromTopic = (topic) => {
  const parts = topic.split('/');
  return parts[parts.length - 1];
};

/**
 * Get topic for publishing to a specific device
 */
const getDeviceTopic = (deviceId, type = 'command') => {
  return `${config.mqtt.topicPrefix}/${type}/${deviceId}`;
};

/**
 * Get bus location topic pattern
 */
const getLocationTopic = (deviceId) => {
  return `${config.mqtt.topicPrefix}/location/${deviceId}`;
};

module.exports = {
  mqttConfig,
  validateDevicePayload,
  validateTelemetryPayload,
  extractDeviceIdFromTopic,
  getDeviceTopic,
  getLocationTopic,
};
