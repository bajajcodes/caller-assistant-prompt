import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { CallStatus } from "twilio/lib/rest/api/v2010/account/call";
import { MODELS } from "./openai";

export type Message = ChatCompletionMessageParam;

export enum CALL_APPLICATION_STATUS {
  REJCTED = "rejected",
  APPROVED = "approved",
  IN_PROCESS = "in-process",
  RE_SUBMIT = "re-submit",
  UNDER_REVIEW = "under-review",
  NA = "NA",
}

export enum CALL_ENDED_BY_WHOM {
  BOT = "bot",
  CALL_TO = "call_to",
  ERROR = "error",
  NA = "NA",
}

export interface Call {
  callSid: string;
  callStatus: CallStatus;
  callEndReason: string;
  callEndedByWhom: CALL_ENDED_BY_WHOM;
  callTranscription: Array<Message>;
  model: MODELS;
  callApplicationStatus: CALL_APPLICATION_STATUS;
}
