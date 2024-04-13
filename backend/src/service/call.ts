import { ChatCompletionSystemMessageParam } from "openai/resources/index.mjs";
import type { RedisClientType } from "redis";
import { CallStatus } from "twilio/lib/rest/api/v2010/account/call";
import {
  CALL_APPLICATION_STATUS,
  CALL_ENDED_BY_WHOM,
  Call,
  Message,
} from "types/call";
import { MODELS } from "types/openai";
import { LLM_MODEL_SWITCH_DURATION } from "utils/config";

const TIMEOUT = LLM_MODEL_SWITCH_DURATION
  ? parseInt(LLM_MODEL_SWITCH_DURATION, 10)
  : 90000;

export class CallService {
  private redisClient: RedisClientType | undefined;
  private isRedisConnected: boolean;
  private _callSid: string | undefined;

  constructor() {
    this.isRedisConnected = false;
  }

  public setRedisClient(client: RedisClientType) {
    this.redisClient = client;
    this.isRedisConnected = true;
  }

  public setCallSid(callSid?: string) {
    this._callSid = callSid;
  }

  get callSid() {
    return this._callSid;
  }

  //TODO: reset llm model after some time
  async createCall(
    callSid: string,
    systemRoleMessage: ChatCompletionSystemMessageParam
  ) {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("callservice: redis client is not connected.");
    }

    const initialCall: Call = {
      callSid,
      callStatus: "queued",
      callEndReason: "",
      model: MODELS.GPT4_1106_PREVIEW,
      callEndedByWhom: CALL_ENDED_BY_WHOM.NA,
      callApplicationStatus: CALL_APPLICATION_STATUS.NA,
      callTranscription: [],
    };

    await this.redisClient.hSet(callSid, {
      callStatus: initialCall.callStatus,
      callEndReason: initialCall.callEndReason,
      model: initialCall.model,
      callEndedByWhom: initialCall.callEndedByWhom,
      callApplicationStatus: initialCall.callApplicationStatus,
    });

    await this.storeMessage(callSid, systemRoleMessage);

    // this.updateCallModelAfterTimeout(callSid);
    console.info(`callservice: call entry created for ${callSid}.`);
  }

  async getCall(callSid: string): Promise<Call | null> {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("callservice: redis client is not connected.");
    }

    const callData = await this.redisClient.hGetAll(callSid);
    // console.info(`Call Data Retrieved for ${callSid}`);
    if (callData) {
      const callTranscription = await this.getConversationHistory(callSid);

      return {
        ...callData,
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
      throw new Error("callservice: redis client is not connected.");
    }
    const existingCall = await this.getCall(callSid);

    if (existingCall) {
      const isCallEndedByAvailable =
        existingCall?.callEndedByWhom !== CALL_ENDED_BY_WHOM.NA;
      if (isCallStatusUpdate && isCallEndedByAvailable) {
        console.info(
          `callservice: call end reason already available cannot update.`
        );
        return;
      }
      const mergedCall = { ...existingCall, ...updatedCall };
      await this.redisClient.hSet(callSid, {
        callStatus: mergedCall.callStatus,
        callEndReason: mergedCall.callEndReason,
        model: mergedCall.model,
        callEndedByWhom: mergedCall.callEndedByWhom,
        callApplicationStatus: mergedCall.callApplicationStatus,
      });

      Object.entries(updatedCall).forEach(([key, value]) => {
        console.info(
          `callservice: updated ${callSid} with ${key} for ${value}.`
        );
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
      throw new Error("callservice: redis client is not connected.");
    }

    const serializedMessage = JSON.stringify(message);
    await this.redisClient.rPush(`${callSid}:transcription`, serializedMessage);
  }

  async getConversationHistory(callSid: string) {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("callservice: redis client is not connected.");
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
      console.log(`callservice: call not found for callSid: ${callSid}.`);
      return false;
    }

    const finishedStatuses: Array<CallStatus> = [
      "completed",
      "busy",
      "canceled",
      "failed",
      "no-answer",
    ];
    console.info(`callservice: ${callSid} status: ${call.callStatus}`);
    return finishedStatuses.includes(call.callStatus);
  }

  async getCallModel(callSid: string): Promise<MODELS | null> {
    if (!this.isRedisConnected || !this.redisClient) {
      throw new Error("callservice: redis client is not connected.");
    }

    const callModel = (await this.redisClient.hGet(callSid, "model")) as MODELS;
    return callModel || null;
  }

  private async updateCallModelAfterTimeout(callSid: string): Promise<void> {
    console.info(
      `callservice: using ${MODELS.GPT_3_5_TUBRO} model for ${callSid}.`
    );

    setTimeout(async () => {
      console.info(
        `callservice: ${TIMEOUT} ms of timer done. switching from: ${MODELS.GPT_3_5_TUBRO} to: ${MODELS.GPT4_1106_PREVIEW}.`
      );

      await this.updateCall(callSid, {
        model: MODELS.GPT4_1106_PREVIEW,
      });
    }, TIMEOUT);
  }
}
