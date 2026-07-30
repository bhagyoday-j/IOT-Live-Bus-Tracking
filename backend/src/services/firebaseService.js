const admin = require('firebase-admin');
const path = require('path');
const config = require('../config/index');
const logger = require('../utils/logger');

class FirebaseService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      if (this.initialized) return;

      const serviceAccountPath = config.firebase.privateKeyPath;
      
      if (serviceAccountPath) {
        const fullPath = path.resolve(serviceAccountPath);
        const serviceAccount = require(fullPath);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: config.firebase.projectId,
        });
      } else {
        // Try environment variable
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } else {
          logger.warn('Firebase not configured - push notifications disabled');
          return;
        }
      }

      this.initialized = true;
      logger.info('Firebase initialized successfully');
    } catch (error) {
      logger.error('Firebase initialization failed:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Send push notification to a specific device
   */
  async sendToDevice(fcmToken, notification, data = {}) {
    if (!this.initialized || !fcmToken) return null;

    try {
      const message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          type: notification.type || 'general',
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'smarttransit_default',
            priority: notification.severity === 'critical' ? 'high' : 'normal',
            sound: 'default',
            vibrationPattern: [500, 500],
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.message,
              },
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info(`Push notification sent to device: ${response}`);
      return response;
    } catch (error) {
      logger.error('Error sending push notification:', error.message);
      
      // Handle invalid token
      if (error.code === 'messaging/registration-token-not-registered') {
        logger.warn(`FCM token ${fcmToken} is no longer valid`);
        // Token should be removed from DB
      }
      
      return null;
    }
  }

  /**
   * Send push notification to multiple devices (topics)
   */
  async sendToTopic(topic, notification, data = {}) {
    if (!this.initialized) return null;

    try {
      const message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          type: notification.type || 'general',
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      };

      const response = await admin.messaging().send(message);
      logger.info(`Topic notification sent to ${topic}: ${response}`);
      return response;
    } catch (error) {
      logger.error('Error sending topic notification:', error.message);
      return null;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToMultipleUsers(fcmTokens, notification, data = {}) {
    if (!this.initialized || !fcmTokens?.length) return [];

    try {
      const messages = fcmTokens.map((token) => ({
        token,
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          type: notification.type || 'general',
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
        },
        android: { priority: 'high' },
      }));

      const response = await admin.messaging().sendEach(messages);
      
      const successCount = response.successCount;
      const failureCount = response.failureCount;
      
      logger.info(`Push notifications sent: ${successCount} success, ${failureCount} failed`);
      
      return response.responses.map((resp, index) => ({
        token: fcmTokens[index],
        success: resp.success,
        error: resp.error?.message || null,
      }));
    } catch (error) {
      logger.error('Error sending bulk notifications:', error.message);
      return [];
    }
  }

  /**
   * Subscribe device to topic
   */
  async subscribeToTopic(fcmToken, topic) {
    if (!this.initialized) return false;

    try {
      await admin.messaging().subscribeToTopic(fcmToken, topic);
      logger.info(`Device subscribed to topic ${topic}`);
      return true;
    } catch (error) {
      logger.error('Error subscribing to topic:', error.message);
      return false;
    }
  }

  /**
   * Unsubscribe device from topic
   */
  async unsubscribeFromTopic(fcmToken, topic) {
    if (!this.initialized) return false;

    try {
      await admin.messaging().unsubscribeFromTopic(fcmToken, topic);
      logger.info(`Device unsubscribed from topic ${topic}`);
      return true;
    } catch (error) {
      logger.error('Error unsubscribing from topic:', error.message);
      return false;
    }
  }

  // Convenience methods for SmartTransit notifications

  async sendBusArrivalNotification(fcmTokens, busNumber, stopName, minutes) {
    return this.sendToMultipleUsers(fcmTokens, {
      title: '🚌 Bus Approaching',
      message: `Bus ${busNumber} is arriving at ${stopName} in ${minutes} minutes.`,
      type: 'arrival',
    }, { busNumber, stopName, minutes: String(minutes) });
  }

  async sendDelayNotification(fcmTokens, busNumber, routeName, delayMinutes) {
    return this.sendToMultipleUsers(fcmTokens, {
      title: '⚠️ Bus Delayed',
      message: `Bus ${busNumber} on ${routeName} is delayed by ${delayMinutes} minutes.`,
      type: 'delay',
      severity: 'warning',
    }, { busNumber, routeName, delayMinutes: String(delayMinutes) });
  }

  async sendCancellationNotification(fcmTokens, busNumber, routeName) {
    return this.sendToMultipleUsers(fcmTokens, {
      title: '❌ Trip Cancelled',
      message: `Bus ${busNumber} on ${routeName} has been cancelled. Please check alternative routes.`,
      type: 'cancellation',
      severity: 'critical',
    }, { busNumber, routeName });
  }

  async sendRouteChangeNotification(fcmTokens, routeName, changeDescription) {
    return this.sendToMultipleUsers(fcmTokens, {
      title: '🔄 Route Changed',
      message: `Route ${routeName} has been changed: ${changeDescription}`,
      type: 'route_change',
    }, { routeName, changeDescription });
  }
}

module.exports = new FirebaseService();
