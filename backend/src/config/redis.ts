import IORedis, { RedisOptions } from 'ioredis';
import { config } from './env';

export const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // REQUIRED by BullMQ: allows blocking operations without aborting
  enableReadyCheck: false,
};

// Shared Redis client for queue producer and rate-limiting operations
export const redisClient = new IORedis(redisOptions);

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

// Factory for isolated connections (e.g. BullMQ worker blocking connections)
export const createRedisClient = () => new IORedis(redisOptions);
