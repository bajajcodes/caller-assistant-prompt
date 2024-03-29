import { getCallService } from "index";
import twillio, { Twilio } from "twilio";
import { CALL_APPLICATION_STATUS, CALL_ENDED_BY_WHOM } from "types/call";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { ResponseType } from "types/openai";
import { AssistantResponse } from "../types/openai";
import {
  HOST,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "../utils/config";
import { getSystemRoleMessage } from "./openai";

let twilioClient: Twilio;
const VoiceResponse = twillio.twiml.VoiceResponse;

const connectTwilio = () => {
  try {
    if (!TWILIO_ACCOUNT_SID) {
      throw Error("Twillio Account SID is Missing");
    }
    if (!TWILIO_AUTH_TOKEN) {
      throw Error("Twillio Auth Token is Missing");
    }
    twilioClient = new twillio.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.info("Connected to Twilio Client.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({ message: "Failed To Connect Twilio Client.", reason });
    throw err;
  }
};

const hangupCall = async (
  callSid: string | null | undefined,
  callEndedBy: CALL_ENDED_BY_WHOM,
  callEndReason: string = "NA"
) => {
  try {
    if (!callSid) {
      console.info(
        `Cannot hangup call, Because CallSid: ${callSid} does not exists.`
      );
      return;
    }
    const callService = getCallService();
    const isCallTerminated = await callService.hasCallFinished(callSid);
    if (isCallTerminated) return;
    await twilioClient.calls(callSid).update({ status: "completed" });
    await callService.updateCall(callSid, {
      callApplicationStatus: CALL_APPLICATION_STATUS.NA,
      callEndedByWhom: callEndedBy,
      callEndReason: callEndReason,
      callStatus: "completed",
    });
    console.info(`Call ${callSid} ended by ${CALL_ENDED_BY_WHOM.BOT}.`);
    console.info("Hangup Call Done.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({ message: "Failed to Hangup Call", reason });
    throw err;
  }
};

const updateInProgessCall = async (
  callSid: string,
  message: AssistantResponse
) => {
  try {
    const { responseType, content } = message;
    if (!callSid) {
      throw Error(`Cannot Update Call, CallSid: ${callSid} Doesn't Exists.`);
    }
    if (responseType === ResponseType.END_CALL) {
      //INFO: content is not spoken out if response type is end call
      await hangupCall(callSid, CALL_ENDED_BY_WHOM.BOT);
      return;
    }
    const response = new VoiceResponse();
    if (responseType === ResponseType.SAY_FOR_VOICE) {
      response.say(content);
    }
    if (responseType === ResponseType.SEND_DIGITS) {
      const digits = content;
      response.play({
        digits,
      });
    }
    const connect = response.connect();
    connect.stream({
      url: `wss://${HOST}`,
      track: "inbound_track",
    });
    response.pause({
      length: 90,
    });
    const twiml = response.toString();
    await twilioClient.calls(callSid).update({
      twiml,
    });
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({
      message: "Failed to Update Call",
      code: err.code,
      callSid,
      reason,
    });
    await hangupCall(
      callSid,
      CALL_ENDED_BY_WHOM.ERROR,
      `Failed to Update Call: ${reason}`
    );
  }
};

const makeacall = async (
  providerData: Record<string, string>
): Promise<void> => {
  try {
    const twilioCallToNumber = providerData.phoneNumber;
    if (!HOST) {
      throw Error("Host Address is Missing");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("Call From Number is Missing");
    }
    if (!twilioCallToNumber) {
      throw Error("Call To Number is Missing");
    }
    const systemRoleMessage = getSystemRoleMessage(providerData);
    const response = new VoiceResponse();
    const connect = response.connect();
    response.say("");
    connect.stream({
      url: `wss://${HOST}`,
      track: "inbound_track",
    });
    response.pause({
      length: 120,
    });
    const twiml = response.toString();
    const call = await twilioClient.calls.create({
      twiml,
      to: twilioCallToNumber,
      from: TWILIO_FROM_NUMBER,
      record: true,
      statusCallback: `https://${HOST}/callupdate`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    const callService = getCallService();
    await callService.createCall(call.sid, systemRoleMessage);
  } catch (err: $TSFixMe) {
    console.error({ err });
  }
};

const makeCallsInBatch = async (batch: Array<$TSFixMe>) => {
  try {
    const promises: Array<unknown> = [];
    batch.forEach((item) => promises.push(makeacall(item)));
    //INFO: if fails to make even a single call discard all
    await Promise.all(promises);
  } catch (err: $TSFixMe) {
    console.error({ err });
  }
};

export {
  connectTwilio,
  hangupCall,
  makeCallsInBatch,
  makeacall,
  twilioClient,
  updateInProgessCall,
};
