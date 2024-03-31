import { ChatCompletionSystemMessageParam } from "openai/resources/index.mjs";
import type { RedisClientType } from "redis";
import { CallStatus } from "twilio/lib/rest/api/v2010/account/call";
import {
  CALL_APPLICATION_STATUS,
  CALL_ENDED_BY_WHOM,
  Call,
  Message,
} from "types/call";
import { ENDPOINTING, MODELS } from "types/openai";
import { LLM_MODEL_SWITCH_DURATION } from "utils/config";

const TIMEOUT = LLM_MODEL_SWITCH_DURATION
  ? parseInt(LLM_MODEL_SWITCH_DURATION, 10)
  : 90000;

export class CallService {
  private redisClient: RedisClientType | undefined;
  private isRedisConnected: boolean;

  constructor() {
    this.isRedisConnected = false;
  }

  public setRedisClient(client: RedisClientType) {
    this.redisClient = client;
    this.isRedisConnected = true;
  }

  //TODO: reset llm model after some time
  async createCall(
    callSid: string,
    systemRoleMessage: ChatCompletionSystemMessageParam
  ) {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("Redis client is not connected");
    }

    const initialCall: Call = {
      endpointing: 25,
      callSid,
      callStatus: "queued",
      callEndReason: "",
      model: MODELS.GPT_3_5_TUBRO,
      callEndedByWhom: CALL_ENDED_BY_WHOM.NA,
      callApplicationStatus: CALL_APPLICATION_STATUS.NA,
      callTranscription: [],
    };

    await this.redisClient.hSet(callSid, {
      endpointing: initialCall.endpointing.toString(),
      callStatus: initialCall.callStatus,
      callEndReason: initialCall.callEndReason,
      model: initialCall.model,
      callEndedByWhom: initialCall.callEndedByWhom,
      callApplicationStatus: initialCall.callApplicationStatus,
    });

    await this.storeMessage(callSid, systemRoleMessage);

    this.updateCallModelAfterTimeout(callSid);
    console.info(`Call Entry Created for ${callSid}`);
  }

  async getCall(callSid: string): Promise<Call | null> {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("Redis client is not connected");
    }

    const callData = await this.redisClient.hGetAll(callSid);
    // console.info(`Call Data Retrieved for ${callSid}`);
    if (callData) {
      const callTranscription = await this.getConversationHistory(callSid);

      return {
        ...callData,
        endpointing: parseInt(callData.endpointing),
        callTranscription,
      } as Call;
    }
    return null;
  }

  async updateCall(
    callSid: string,
    updatedCall: Partial<Call>,
    isCallStatusUpdate: boolean = false
  ) {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("Redis client is not connected");
    }
    const existingCall = await this.getCall(callSid);

    if (existingCall) {
      const isCallEndedByAvailable =
        existingCall?.callEndedByWhom !== CALL_ENDED_BY_WHOM.NA;
      if (isCallStatusUpdate && isCallEndedByAvailable) {
        console.info(`Call End Reason Already Available cannot Update`);
        return;
      }
      const mergedCall = { ...existingCall, ...updatedCall };
      await this.redisClient.hSet(callSid, {
        endpointing: mergedCall.endpointing.toString(),
        callStatus: mergedCall.callStatus,
        callEndReason: mergedCall.callEndReason,
        model: mergedCall.model,
        callEndedByWhom: mergedCall.callEndedByWhom,
        callApplicationStatus: mergedCall.callApplicationStatus,
      });

      Object.entries(updatedCall).forEach(([key, value]) => {
        console.info(`Updated: ${callSid} with ${key} for ${value}.`);
      });
      if (updatedCall.callTranscription) {
        for (const message of updatedCall.callTranscription) {
          await this.redisClient.rPush(
            `${callSid}:transcription`,
            JSON.stringify(message)
          );
        }
      }
    }
  }

  async storeMessage(callSid: string, message: Message) {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("Redis client is not connected");
    }

    const serializedMessage = JSON.stringify(message);
    await this.redisClient.rPush(`${callSid}:transcription`, serializedMessage);
  }

  async getConversationHistory(callSid: string) {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("Redis client is not connected");
    }

    const history = await this.redisClient.lRange(
      `${callSid}:transcription`,
      0,
      -1
    );
    const parsedHistory = history.map(
      (message) => JSON.parse(message) as Message
    );
    return parsedHistory;
  }

  async hasCallFinished(callSid: string): Promise<boolean> {
    const call = await this.getCall(callSid);
    if (call === null) {
      console.log(`Call not found for callSid: ${callSid}`);
      return false;
    }

    const finishedStatuses: Array<CallStatus> = [
      "completed",
      "busy",
      "canceled",
      "failed",
      "no-answer",
    ];

    return finishedStatuses.includes(call.callStatus);
  }

  async getCallModel(callSid: string): Promise<MODELS | null> {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("Redis client is not connected");
    }

    const callModel = (await this.redisClient.hGet(callSid, "model")) as MODELS;
    return callModel || null;
  }

  private async updateCallModelAfterTimeout(callSid: string): Promise<void> {
    console.info(`Using ${MODELS.GPT_3_5_TUBRO} Model for ${callSid}.`);
    // console.info(
    //   `Using Endpointing of ${ENDPOINTING.INITAL} ms for ${callSid}.`
    // );

    setTimeout(async () => {
      console.info(
        `${TIMEOUT} ms of timer done. Switching from: ${MODELS.GPT_3_5_TUBRO} to: ${MODELS.GPT4_1106_PREVIEW}.`
      );
      // console.info(
      //   `Using Endpointing of ${ENDPOINTING.AFTER_TIMEOUT} ms for ${callSid}.`
      // );

      await this.updateCall(callSid, {
        model: MODELS.GPT4_1106_PREVIEW,
        endpointing: ENDPOINTING.AFTER_TIMEOUT,
      });
    }, TIMEOUT);
  }
}
