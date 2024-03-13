import { createClient } from "redis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { REDIS_CLIENT_URL } from "utils/config";

export const connectRedis = async () => {
  try {
    const client = createClient({
      url: REDIS_CLIENT_URL,
    });
    client.on("error", (err) => {
      throw err?.message || "Redis Client Error";
    });
    await client.connect();
    console.info("Connected to Redis Client");
    return client;
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Connect to Redis";
    throw Error(message);
  }
};
