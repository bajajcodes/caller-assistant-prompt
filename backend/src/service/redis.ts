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
    console.info("Connected to Redis Client");
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Connect to Redis";
    console.error(message);
    throw err;
  }
};

export { connectRedis, redisClient };
