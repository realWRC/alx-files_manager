// utils/redis.js

const redis = require('redis');
const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    // Handle connection errors
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    // Handle successful connection
    this.client.on('connect', () => {
      console.log('Connected to Redis successfully');
    });

    // Promisify Redis client methods for async/await
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  /**
   * Checks if the Redis client is alive (connected).
   * @returns {boolean} True if connected, else false.
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Retrieves the value associated with the given key from Redis.
   * @param {string} key - The key to retrieve.
   * @returns {Promise<string|null>} The value or null if not found.
   */
  async get(key) {
    try {
      const value = await this.getAsync(key);
      return value;
    } catch (err) {
      console.error(`Error getting key "${key}" from Redis:`, err);
      return null;
    }
  }

  /**
   * Sets a key-value pair in Redis with an expiration time.
   * @param {string} key - The key to set.
   * @param {string|number} value - The value to set.
   * @param {number} duration - Expiration time in seconds.
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    try {
      // In Redis v3.x, to set expiration, you pass 'EX' followed by the duration
      await this.setAsync(key, value, 'EX', duration);
    } catch (err) {
      console.error(`Error setting key "${key}" in Redis:`, err);
    }
  }

  /**
   * Deletes a key from Redis.
   * @param {string} key - The key to delete.
   * @returns {Promise<void>}
   */
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error(`Error deleting key "${key}" from Redis:`, err);
    }
  }
}

// Create and export an instance of RedisClient
const redisClient = new RedisClient();

module.exports = redisClient;
