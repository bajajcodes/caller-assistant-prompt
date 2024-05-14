import { redisClient } from "./redis";

export enum CallLogKeys {
  SID = "sid",
  CALL_STATUS = "callStatus",
  TRANSCRIPTION = "transcription",
  IVR_TRANSCRIPTION = "ivr--transcription",
  UPDATED_AT = "updatedAt",
  APPLICATION_STATUS = "applicationStatus",
}

interface CallLog {
  [CallLogKeys.SID]: string;
  [CallLogKeys.CALL_STATUS]: string;
  [CallLogKeys.TRANSCRIPTION]: { role: string; content: string }[];
  [CallLogKeys.IVR_TRANSCRIPTION]: { role: string; content: string }[];
  [CallLogKeys.UPDATED_AT]: number;
  [CallLogKeys.APPLICATION_STATUS]: Record<string, string>;
}

const EXPIRATION_DAYS = 7; // Expiration time in days
const EXPIRATION_SECONDS = EXPIRATION_DAYS * 24 * 60 * 60; // Convert days to seconds

const CallLogService = (function () {
  async function create(
    sid: string,
    keyType: CallLogKeys,
    value: string | Record<string, string>
  ): Promise<void> {
    const key = `call_${sid}_${keyType}`;
    const updatedAt = Date.now();

    if (typeof value === "string") {
      await Promise.all([
        redisClient.set(key, value),
        redisClient.expire(key, EXPIRATION_SECONDS),
      ]);
    } else {
      const serializedValue = JSON.stringify(value);
      await Promise.all([
        redisClient.rPush(key, serializedValue),
        redisClient.expire(key, EXPIRATION_SECONDS),
      ]);
    }

    await Promise.all([
      redisClient.set(`call_${sid}_updatedAt`, updatedAt.toString()),
      redisClient.expire(`call_${sid}_updatedAt`, EXPIRATION_SECONDS),
    ]);
  }

  async function read(sid: string): Promise<CallLog | null> {
    const [
      callStatus,
      updatedAt,
      applicationStatusJson,
      interactionTranscription,
      ivrTranscription,
    ] = await Promise.all([
      redisClient.get(`call_${sid}_${CallLogKeys.CALL_STATUS}`),
      redisClient.get(`call_${sid}_${CallLogKeys.UPDATED_AT}`),
      redisClient.get(`call_${sid}_${CallLogKeys.APPLICATION_STATUS}`),
      redisClient.lRange(`call_${sid}_${CallLogKeys.TRANSCRIPTION}`, 0, -1),
      redisClient.lRange(`call_${sid}_${CallLogKeys.IVR_TRANSCRIPTION}`, 0, -1),
    ]);

    if (!callStatus) {
      return null;
    }

    return {
      sid,
      callStatus,
      [CallLogKeys.UPDATED_AT]: parseInt(updatedAt || "0", 10),
      [CallLogKeys.APPLICATION_STATUS]: JSON.parse(applicationStatusJson || ""),
      [CallLogKeys.TRANSCRIPTION]: interactionTranscription.map((entry) =>
        JSON.parse(entry)
      ),
      [CallLogKeys.IVR_TRANSCRIPTION]: ivrTranscription.map((entry) =>
        JSON.parse(entry)
      ),
    };
  }

  async function update(
    callSid: string,
    keyType: CallLogKeys.TRANSCRIPTION | CallLogKeys.IVR_TRANSCRIPTION,
    value: object
  ): Promise<void> {
    const key = `call_${callSid}_${keyType}`;
    const serializedValue = JSON.stringify(value);
    await redisClient.rPush(key, serializedValue);
  }

  async function deleteCallLog(callSid: string): Promise<void> {
    const keys = await redisClient.keys(`call_${callSid}_*`);
    await Promise.all(keys.map((key) => redisClient.del(key)));
  }

  async function get(callSid: string, keyType: CallLogKeys) {
    const key = `call_${callSid}_${keyType}`;

    if (
      keyType === CallLogKeys.TRANSCRIPTION ||
      keyType === CallLogKeys.IVR_TRANSCRIPTION
    ) {
      const transcription = await redisClient.lRange(key, 0, -1);
      return transcription.map((e) => JSON.parse(e));
    }

    if (keyType === CallLogKeys.APPLICATION_STATUS) {
      const applicationStatusString = await redisClient.get(key);
      return applicationStatusString ? JSON.parse(applicationStatusString) : {};
    }

    return await redisClient.get(key);
  }

  return {
    create,
    read,
    update,
    get,
    delete: deleteCallLog,
  };
})();

export { CallLogService };
