import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient();

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    this.client.connect()
      .then(() => {
        console.log('Connected to Redis successfully');
      })
      .catch((err) => {
        console.error('Failed to connect to Redis', err);
      });
  }

  isAlive() {
    return this.client.isOpen;
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value;
    } catch (err) {
      console.error(`Error getting key "${key}" from Redis:`, err);
      return null;
    }
  }

  async set(key, value, duration) {
    try {
      await this.client.set(key, value, {
        EX: duration,
      });
    } catch (err) {
      console.error(`Error setting key "${key}" in Redis:`, err);
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (err) {
      console.error(`Error deleting key "${key}" from Redis:`, err);
    }
  }
}

const redisClient = new RedisClient();

export default redisClient;
