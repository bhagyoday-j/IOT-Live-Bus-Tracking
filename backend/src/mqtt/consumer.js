const mqtt = require('mqtt');
const config = require('../config/index');
const { mqttConfig, validateDevicePayload, validateTelemetryPayload, extractDeviceIdFromTopic } = require('../config/mqtt');
const Bus = require('../models/Bus');
const BusLocation = require('../models/BusLocation');
const SOSAlert = require('../models/SOSAlert');
const Trip = require('../models/Trip');
const delayDetectionService = require('../services/delayDetectionService');
const etaService = require('../services/etaService');
const telemetryService = require('../services/telemetryService');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

let io = null; // Socket.IO instance, set externally

class MQTTConsumer {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxRetries = 10;
    this.stats = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      lastMessageAt: null,
      connectedSince: null,
    };
  }

  /**
   * Set Socket.IO instance for emitting events
   */
  setSocketIO(ioInstance) {
    io = ioInstance;
  }

  /**
   * Initialize MQTT connection and subscriptions
   */
  async connect() {
    try {
      logger.info(`Connecting to MQTT broker at ${mqttConfig.brokerUrl}...`);

      this.client = mqtt.connect(mqttConfig.brokerUrl, mqttConfig.options);

      this.client.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.stats.connectedSince = new Date().toISOString();
        logger.info(`MQTT connected as ${mqttConfig.options.clientId}`);

        // Subscribe to all required topics
        this.subscribeToTopics();

        // Publish online status
        this.publishOnlineStatus();
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload);
      });

      this.client.on('error', (error) => {
        logger.error('MQTT error:', error.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('MQTT connection closed');
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        logger.info(`MQTT reconnecting (attempt ${this.reconnectAttempts})...`);
      });

      this.client.on('offline', () => {
        this.isConnected = false;
        logger.warn('MQTT client went offline');
      });

      return this.client;
    } catch (error) {
      logger.error('Failed to initialize MQTT:', error.message);
      throw error;
    }
  }

  /**
   * Subscribe to all configured topics
   */
  subscribeToTopics() {
    mqttConfig.subscriptions.forEach(({ topic, qos }) => {
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err.message);
        } else {
          logger.info(`Subscribed to MQTT topic: ${topic}`);
        }
      });
    });
  }

  /**
   * Publish backend online status
   */
  publishOnlineStatus() {
    const statusTopic = `${config.mqtt.topicPrefix}/status/backend`;
    const statusPayload = JSON.stringify({
      status: 'online',
      timestamp: Date.now(),
      version: '1.0.0',
    });
    this.client.publish(statusTopic, statusPayload, { qos: 1, retain: true });
  }

  /**
   * Handle incoming MQTT messages
   */
  async handleMessage(topic, payload) {
    this.stats.messagesReceived++;
    this.stats.lastMessageAt = new Date().toISOString();

    try {
      const messageStr = payload.toString();
      const message = JSON.parse(messageStr);
      const deviceId = extractDeviceIdFromTopic(topic);

      logger.debug(`MQTT received: ${topic} from ${deviceId}`);

      if (topic.includes('/location/')) {
        await this.processLocationUpdate(deviceId, message);
      } else if (topic.includes('/telemetry/')) {
        await this.processTelemetryUpdate(deviceId, message);
      } else if (topic.includes('/status/')) {
        await this.processStatusUpdate(deviceId, message);
      } else if (topic.includes('/alert/')) {
        await this.processAlert(deviceId, message);
      }

      this.stats.messagesProcessed++;
    } catch (error) {
      this.stats.messagesFailed++;
      logger.error(`Failed to process MQTT message on ${topic}:`, error.message);
    }
  }

  /**
   * Process GPS location update from a device
   */
  async processLocationUpdate(deviceId, data) {
    // Validate payload
    const validation = validateDevicePayload(data);
    if (!validation.isValid) {
      logger.warn(`Invalid device payload from ${deviceId}:`, validation.errors);
      return;
    }

    // Find the bus associated with this device
    const bus = await Bus.findOne({ deviceId });
    if (!bus) {
      logger.warn(`Unknown device ${deviceId} - no bus registered with this device ID`);
      return;
    }

    const { lat, lng, speed, heading, timestamp, sos, altitude, batteryLevel } = data;

    // Update bus current location in real-time
    bus.currentLocation = {
      lat,
      lng,
      speed: speed || 0,
      heading: heading || 0,
      updatedAt: new Date(timestamp || Date.now()),
    };

    if (sos !== undefined) bus.sosActive = sos;
    await bus.save();

    // Store location history in database
    const locationRecord = await BusLocation.create({
      busId: bus._id,
      deviceId,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      speed: speed || 0,
      heading: heading || 0,
      altitude: altitude || 0,
      batteryLevel: batteryLevel || 0,
      sos: sos || false,
      timestamp: new Date(timestamp || Date.now()),
    });

    // Cache latest location in Redis for fast retrieval
    await redisService.cacheBusLocation(bus._id.toString(), {
      busId: bus._id,
      busNumber: bus.number,
      deviceId,
      lat,
      lng,
      speed,
      heading,
      timestamp: locationRecord.timestamp,
    });

    // Handle SOS alert
    if (sos) {
      await this.handleSOSAlert(bus, deviceId, { lat, lng, speed, heading });
    }

    // Update trip progress if bus is on a route
    if (bus.routeId && (bus.status === 'on-route' || bus.status === 'delayed')) {
      const route = await bus.populate('routeId');
      const routeData = route.routeId;

      // Check for delays
      delayDetectionService.checkBusDelay(bus, routeData, { lat, lng, speed }).catch(err => {
        logger.error(`Delay check error for bus ${bus.number}:`, err.message);
      });

      // Update trip location
      Trip.findOneAndUpdate(
        { busId: bus._id, status: 'in-progress' },
        {
          $set: {
            'routeDeviation.detected': false,
          },
        },
        { sort: { startTime: -1 } }
      ).catch(err => {
        logger.error(`Trip update error for bus ${bus.number}:`, err.message);
      });
    }

    // Emit Socket.IO event to all tracking clients
    if (io) {
      const locationEvent = {
        busId: bus._id,
        busNumber: bus.number,
        deviceId,
        lat,
        lng,
        speed: speed || 0,
        heading: heading || 0,
        status: bus.status,
        delay: bus.delay || 0,
        sos: sos || bus.sosActive || false,
        timestamp: locationRecord.timestamp,
      };

      // Emit to bus-specific room and general tracking room
      io.to(`bus:${bus._id}`).emit('busLocationUpdated', locationEvent);
      io.to('role:depot_manager').emit('busLocationUpdated', locationEvent);
      io.to('role:admin').emit('busLocationUpdated', locationEvent);
      io.emit('busLocationUpdated', locationEvent);
    }
  }

  /**
   * Process sensor telemetry update from a device (health/safety data)
   */
  async processTelemetryUpdate(deviceId, data) {
    const validation = validateTelemetryPayload(data);
    if (!validation.isValid) {
      logger.warn(`Invalid telemetry payload from ${deviceId}:`, validation.errors);
      return;
    }

    const result = await telemetryService.processTelemetry(deviceId, data);
    if (!result.success) {
      logger.warn(`Telemetry processing failed for ${deviceId}:`, result.errors);
    }
  }

  /**
   * Process status update from a device (online/offline)
   */
  async processStatusUpdate(deviceId, data) {
    const bus = await Bus.findOne({ deviceId });
    if (!bus) {
      logger.warn(`Status update for unknown device ${deviceId}`);
      return;
    }

    const { status, ...rest } = data;

    logger.info(`Bus ${bus.number} (${deviceId}) status: ${status}`);

    if (status === 'offline' || status === 'disconnected') {
      if (bus.status === 'on-route') {
        // Don't change route status, but log it
        logger.warn(`Bus ${bus.number} went offline while on route`);
      }
    } else if (status === 'online' || status === 'connected') {
      // Bus came back online - if it was delayed, check current state
      if (bus.status === 'delayed') {
        logger.info(`Bus ${bus.number} reconnected - re-evaluating delay`);
      }
    }

    // Emit status change event
    if (io) {
      io.emit('busStatusChanged', {
        busId: bus._id,
        busNumber: bus.number,
        deviceId,
        status: bus.status,
        deviceStatus: status,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Process an alert from a device (e.g., panic button, accident)
   */
  async processAlert(deviceId, data) {
    const bus = await Bus.findOne({ deviceId });
    if (!bus) {
      logger.warn(`Alert from unknown device ${deviceId}`);
      return;
    }

    const { type, lat, lng, message } = data;

    logger.warn(`ALERT from bus ${bus.number} (${deviceId}): ${type}`);

    if (type === 'sos' || type === 'panic') {
      await this.handleSOSAlert(bus, deviceId, { lat, lng, speed: 0, heading: 0 });
    }

    // Create notification
    const Notification = require('../models/Notification');
    await Notification.create({
      type: type === 'sos' ? 'sos' : 'system',
      title: `Alert from Bus ${bus.number}`,
      message: message || `${type} alert received from bus ${bus.number}`,
      severity: 'critical',
      busId: bus._id,
      data: {
        alertType: type,
        deviceId,
        lat,
        lng,
      },
      audience: ['admins', 'depot_managers'],
    });

    // Emit alert event
    if (io) {
      io.emit('busAlert', {
        busId: bus._id,
        busNumber: bus.number,
        deviceId,
        type,
        lat,
        lng,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle SOS alert with database record and notifications
   */
  async handleSOSAlert(bus, deviceId, location) {
    try {
      await SOSAlert.create({
        busId: bus._id,
        deviceId,
        driverId: bus.driverId,
        location: {
          type: 'Point',
          coordinates: [location.lng, location.lat],
        },
        speed: location.speed || 0,
        heading: location.heading || 0,
        timestamp: new Date(),
        severity: 'critical',
      });

      bus.sosActive = true;
      bus.sosActivatedAt = new Date();
      await bus.save();

      logger.warn(`🚨 SOS triggered for bus ${bus.number} (${deviceId}) at [${location.lat}, ${location.lng}]`);

      if (io) {
        io.emit('busSOS', {
          busId: bus._id,
          busNumber: bus.number,
          deviceId,
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error handling SOS alert:', error.message);
    }
  }

  /**
   * Publish a command to a specific device
   */
  publishCommand(deviceId, command, payload = {}) {
    if (!this.client || !this.isConnected) {
      logger.error('Cannot publish command - MQTT not connected');
      return false;
    }

    const topic = `${config.mqtt.topicPrefix}/command/${deviceId}`;
    const message = JSON.stringify({
      command,
      ...payload,
      timestamp: Date.now(),
    });

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`Failed to publish command to ${deviceId}:`, err.message);
      } else {
        logger.info(`Command '${command}' sent to device ${deviceId}`);
      }
    });

    return true;
  }

  /**
   * Publish a notification/alert to a device
   */
  publishAlert(deviceId, type, message) {
    if (!this.client || !this.isConnected) return false;

    const topic = `${config.mqtt.topicPrefix}/alert/${deviceId}`;
    const payload = JSON.stringify({
      type,
      message,
      timestamp: Date.now(),
    });

    this.client.publish(topic, payload, { qos: 1 });
    return true;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      clientId: mqttConfig.options.clientId,
      brokerUrl: mqttConfig.brokerUrl,
    };
  }

  /**
   * Gracefully disconnect MQTT
   */
  async disconnect() {
    if (this.client) {
      // Publish offline status
      const statusTopic = `${config.mqtt.topicPrefix}/status/backend`;
      this.client.publish(statusTopic, JSON.stringify({
        status: 'offline',
        timestamp: Date.now(),
      }), { qos: 1, retain: true });

      // Give a moment for the last will to be sent
      await new Promise(resolve => setTimeout(resolve, 500));
      this.client.end(true);
      this.isConnected = false;
      logger.info('MQTT disconnected gracefully');
    }
  }
}

module.exports = new MQTTConsumer();
