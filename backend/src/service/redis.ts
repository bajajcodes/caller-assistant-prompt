import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import type { RedisClientType } from "redis";
import { createClient } from "redis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { STORE_KEYS } from "types/redis";
import { REDIS_CLIENT_URL } from "utils/config";

type Message = ChatCompletionMessageParam;

let redisClient: RedisClientType;
let currentActiveCallCount = 0;

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

async function storeMessage(callSid: string, message: Message) {
  const serializedMessage = JSON.stringify(message);
  await redisClient.rPush(callSid, serializedMessage);
}

async function getConversationHistory(callSid: string) {
  const history = await redisClient.lRange(callSid, 0, -1);
  const parsedHistory = history.map(
    (message) => JSON.parse(message) as Message
  );
  return parsedHistory;
}

async function removeConversationHistory(callSid: string) {
  await redisClient.del(callSid);
  decrementActiveCallCount();
}

async function incrementActiveCallCount() {
  // await redisClient.incr("activeCallCount");
  //TODO: use redis
  currentActiveCallCount++;
}

async function decrementActiveCallCount() {
  // await redisClient.decr("activeCallCount");
  //TODO: use redis
  currentActiveCallCount--;
}

function getCurrentActiveCallCount(): number {
  return currentActiveCallCount;
}

export {
  connectRedis,
  getConversationHistory,
  getCurrentActiveCallCount,
  incrementActiveCallCount,
  removeConversationHistory,
  storeHost,
  storeMessage,
};
