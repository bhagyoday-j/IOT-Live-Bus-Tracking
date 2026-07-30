const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxRetries = 5;
  }

  async connect() {
    if (this.isConnected) return;

    try {
      mongoose.set('strictQuery', true);

      const conn = await mongoose.connect(config.mongodb.uri, {
        ...config.mongodb.options,
        maxPoolSize: 50,
        minPoolSize: 10,
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info(`MongoDB connected: ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
        this.handleReconnect();
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      logger.error('MongoDB connection failed:', error.message);
      this.isConnected = false;
      
      if (this.reconnectAttempts < this.maxRetries) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        logger.info(`Retrying connection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect();
      }

      throw error;
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxRetries) {
      logger.error('Max reconnection attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (err) {
        logger.error('Reconnection failed:', err.message);
      }
    }, delay);
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting MongoDB:', error.message);
    }
  }

  async healthCheck() {
    try {
      const state = mongoose.connection.readyState;
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      return {
        status: state === 1 ? 'healthy' : 'unhealthy',
        state: ['disconnected', 'connected', 'connecting', 'disconnecting'][state],
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new Database();
