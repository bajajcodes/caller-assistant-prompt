import type { RedisClientType } from "redis";
import { createClient } from "redis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { STORE_KEYS } from "types/redis";
import { REDIS_CLIENT_URL } from "utils/config";

export let redisClient: RedisClientType;

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
    const reason = err?.message;
    console.error({ message: "Failed to Connect to Redis", reason });
    throw err;
  }
};

async function storeHost(host: string) {
  await redisClient.set(STORE_KEYS.HOST, host);
}

export { connectRedis, storeHost };
