import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import type { RedisClientType } from "redis";
import { createClient } from "redis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { STORE_KEYS } from "types/redis";
import { REDIS_CLIENT_URL } from "utils/config";

type Message = ChatCompletionMessageParam;

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
}

async function storeCallStatus(callSid: string, callStatus: string) {
  await redisClient.hSet(`call:${callSid}`, "status", callStatus);
}

async function getCallStatus(callSid: string): Promise<string | null> {
  const status = await redisClient.hGet(`call:${callSid}`, "status");
  return status || null;
}

async function hasCallFinished(callSid: string): Promise<boolean> {
  const status = await getCallStatus(callSid);
  if (status === null) {
    console.log(`Call status not found for callSid: ${callSid}`);
    return false;
  }
  const finishedStatuses = [
    "completed",
    "busy",
    "canceled",
    "failed",
    "no-answer",
  ];
  return finishedStatuses.includes(status);
}

export {
  connectRedis,
  getCallStatus,
  getConversationHistory,
  hasCallFinished,
  removeConversationHistory,
  storeCallStatus,
  storeHost,
  storeMessage,
};
