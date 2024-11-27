import { IVRMenu } from "./ivr-service";
import { redisClient } from "./redis";

export enum CallLogKeys {
  SID = "sid",
  CALL_STATUS = "callstatus",
  CALL_ENDED_BY = "callEndedBy",
  TRANSCRIPTION = "transcription",
  IVR_TRANSCRIPTION = "ivr--transcription",
  UPDATED_AT = "updatedAt",
  APPLICATION_STATUS = "applicationStatus",
  WEBHOOK_TRIGGER_STATUS = "webhookTriggerStatus",
  PROVIDED_IVR_MENU = "providedIvrMenu",
  TRANSFORMED_IVR_MENU = "transformedIvrMenu",
  INTERNAL_USED_IVR_MENU = "internalUsedIvrMenu",
}

export interface CallApplicationJson {
  status: string;
  data: Array<Record<string, string>>;
}

interface CallLog {
  [CallLogKeys.SID]: string;
  [CallLogKeys.CALL_STATUS]: string;
  [CallLogKeys.CALL_ENDED_BY]: string;
  [CallLogKeys.TRANSCRIPTION]: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  [CallLogKeys.IVR_TRANSCRIPTION]: {
    role: "user" | "assistant";
    content: string;
  }[];
  [CallLogKeys.UPDATED_AT]: number;
  [CallLogKeys.APPLICATION_STATUS]: CallApplicationJson;
  [CallLogKeys.WEBHOOK_TRIGGER_STATUS]: string;
  [CallLogKeys.PROVIDED_IVR_MENU]: Array<IVRMenu>;
  [CallLogKeys.TRANSFORMED_IVR_MENU]: Array<IVRMenu>;
  [CallLogKeys.INTERNAL_USED_IVR_MENU]: Array<IVRMenu>;
}

const callLogArrayTypeKeyNames: Array<CallLogKeys> = [
  CallLogKeys.TRANSCRIPTION,
  CallLogKeys.IVR_TRANSCRIPTION,
  CallLogKeys.PROVIDED_IVR_MENU,
  CallLogKeys.TRANSFORMED_IVR_MENU,
  CallLogKeys.INTERNAL_USED_IVR_MENU,
];

const EXPIRATION_DAYS = 7; // Expiration time in days
const EXPIRATION_SECONDS = EXPIRATION_DAYS * 24 * 60 * 60; // Convert days to seconds

const CallLogService = (function () {
  async function create(
    sid: string,
    keyType: CallLogKeys,
    value:
      | string
      | Record<string, string>
      | CallApplicationJson
      | Array<IVRMenu>
  ): Promise<void> {
    const key = `${sid}__${keyType}`;
    const updatedAt = Date.now();

    if (callLogArrayTypeKeyNames.includes(keyType)) {
      const serializedValue = JSON.stringify(value);
      await Promise.all([
        redisClient.rPush(key, serializedValue),
        redisClient.expire(key, EXPIRATION_SECONDS),
      ]);
    } else {
      const valueString =
        typeof value === "string" ? value : JSON.stringify(value);
      await Promise.all([
        redisClient.set(key, valueString),
        redisClient.expire(key, EXPIRATION_SECONDS),
      ]);
    }

    await Promise.all([
      redisClient.set(`${sid}__updatedAt`, updatedAt.toString()),
      redisClient.expire(`${sid}__updatedAt`, EXPIRATION_SECONDS),
    ]);
  }

  async function read(sid: string): Promise<CallLog | null> {
    const [
      callstatus,
      callEndedBy,
      updatedAt,
      applicationStatusJson,
      webhookTriggerStatus,
      interactionTranscription,
      ivrTranscription,
      providedIvrMenu,
      transformedIvrMenu,
      internalUsedIvrMenu,
    ] = await Promise.all([
      redisClient.get(`${sid}__${CallLogKeys.CALL_STATUS}`),
      redisClient.get(`${sid}__${CallLogKeys.CALL_ENDED_BY}`),
      redisClient.get(`${sid}__${CallLogKeys.UPDATED_AT}`),
      redisClient.get(`${sid}__${CallLogKeys.APPLICATION_STATUS}`),
      redisClient.get(`$${sid}__${CallLogKeys.WEBHOOK_TRIGGER_STATUS}`),
      redisClient.lRange(`${sid}__${CallLogKeys.TRANSCRIPTION}`, 0, -1),
      redisClient.lRange(`${sid}__${CallLogKeys.IVR_TRANSCRIPTION}`, 0, -1),
      redisClient.lRange(`${sid}__${CallLogKeys.PROVIDED_IVR_MENU}`, 0, -1),
      redisClient.lRange(`${sid}__${CallLogKeys.TRANSFORMED_IVR_MENU}`, 0, -1),
      redisClient.lRange(
        `${sid}__${CallLogKeys.INTERNAL_USED_IVR_MENU}`,
        0,
        -1
      ),
    ]);

    if (!callstatus) {
      return null;
    }
    //TODO: refactor following code
    return {
      sid,
      callstatus,
      callEndedBy: callEndedBy || "NA",
      webhookTriggerStatus: webhookTriggerStatus || "NA",
      [CallLogKeys.UPDATED_AT]: parseInt(updatedAt || "0", 10),
      [CallLogKeys.APPLICATION_STATUS]: applicationStatusJson
        ? JSON.parse(applicationStatusJson)
        : {},
      [CallLogKeys.TRANSCRIPTION]: interactionTranscription
        .map((entry) => JSON.parse(entry))
        .filter((entry) => entry.role !== "system"),
      [CallLogKeys.IVR_TRANSCRIPTION]: ivrTranscription.map((entry) =>
        JSON.parse(entry)
      ),
      [CallLogKeys.PROVIDED_IVR_MENU]: providedIvrMenu.map((e) =>
        JSON.parse(e)
      ),
      [CallLogKeys.TRANSFORMED_IVR_MENU]: transformedIvrMenu.map((e) =>
        JSON.parse(e)
      ),
      [CallLogKeys.INTERNAL_USED_IVR_MENU]: internalUsedIvrMenu.map((e) =>
        JSON.parse(e)
      ),
    };
  }

  async function update(
    callSid: string,
    keyType: CallLogKeys.TRANSCRIPTION | CallLogKeys.IVR_TRANSCRIPTION,
    value: object
  ): Promise<void> {
    const key = `${callSid}__${keyType}`;
    const serializedValue = JSON.stringify(value);
    await redisClient.rPush(key, serializedValue);
  }

  async function deleteCallLog(callSid: string): Promise<void> {
    const keys = await redisClient.keys(`${callSid}_*`);
    await Promise.all(keys.map((key) => redisClient.del(key)));
  }

  async function get(
    callSid: string,
    keyType: CallLogKeys
  ): Promise<
    | string
    | Array<{ role: "user" | "assistant" | "system"; content: string }>
    | Array<IVRMenu>
    | CallApplicationJson
    | null
  > {
    const key = `${callSid}__${keyType}`;

    if (callLogArrayTypeKeyNames.includes(keyType)) {
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
