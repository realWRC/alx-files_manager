const Bull = require('bull');
const redisClient = require('./redis');

const fileQueue = new Bull('fileQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});

module.exports = fileQueue;
