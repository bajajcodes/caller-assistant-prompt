import type { RedisClientType } from "redis";
import { createClient } from "redis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { REDIS_CLIENT_URL } from "utils/config";

let redisClient: RedisClientType;

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: REDIS_CLIENT_URL,
    });
    redisClient.on("error", (err) => {
      throw err?.message || "Redis Client Error";
    });
    await redisClient.connect();
    console.info("redis: connected to redis client.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`redis: ${reason || "failed to connect to redis"}.`);
    throw err;
  }
};

export { connectRedis, redisClient };
