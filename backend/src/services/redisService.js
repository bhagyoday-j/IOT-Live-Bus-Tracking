const Redis = require('ioredis');
const config = require('../config/index');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.DEFAULT_TTL = 3600; // 1 hour
    this.LOCATION_TTL = 300; // 5 minutes
  }

  async connect() {
    try {
      this.client = new Redis(config.redis.url, {
        password: config.redis.password,
        retryStrategy: config.redis.retryStrategy,
        maxRetries: config.redis.maxRetries,
        enableAutoPipelining: true,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected');
      });

      this.client.on('error', (err) => {
        logger.error('Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Redis connection failed:', error.message);
      // Don't throw - allow app to work without Redis
    }
  }

  async get(key) {
    if (!this.client || !this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = this.DEFAULT_TTL) {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error.message);
    }
  }

  async del(key) {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Redis del error for key ${key}:`, error.message);
    }
  }

  // Bus location caching
  async cacheBusLocation(busId, locationData) {
    const key = `bus:location:${busId}`;
    await this.set(key, locationData, this.LOCATION_TTL);
  }

  async getBusLocation(busId) {
    const key = `bus:location:${busId}`;
    return this.get(key);
  }

  // Cache busting for a pattern
  async invalidatePattern(pattern) {
    if (!this.client || !this.isConnected) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error(`Redis invalidate pattern error:`, error.message);
    }
  }

  async increment(key, ttl = this.DEFAULT_TTL) {
    if (!this.client || !this.isConnected) return;
    try {
      const val = await this.client.incr(key);
      if (val === 1 && ttl) {
        await this.client.expire(key, ttl);
      }
      return val;
    } catch (error) {
      logger.error(`Redis increment error:`, error.message);
      return 0;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

module.exports = new RedisService();
