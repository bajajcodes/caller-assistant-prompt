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
      throw Error("twilio: account sid is missing.");
    }
    if (!TWILIO_AUTH_TOKEN) {
      throw Error("twilio: auth token is missing.");
    }
    twilioClient = new twillio.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.info("twilio: connected to twilio client.");
  } catch (err: $TSFixMe) {
    const reason = err?.message || "failed to connect twilio client";
    console.error(`twilio: ${reason}.`);
    throw err;
  }
};

const hangupCall = async ({
  callSid,
  callEndedBy,
  callEndReason = "NA",
}: {
  callSid?: string | null;
  callEndedBy: CALL_ENDED_BY_WHOM;
  callEndReason?: string;
}) => {
  try {
    if (!callSid) {
      console.info(
        `twilio: cannot hangup call, because callsid: ${callSid} does not exists.`
      );
      return;
    }
    const callService = getCallService();
    const isCallTerminated = await callService.hasCallFinished(callSid);
    if (isCallTerminated) {
      console.info(`twilio: call is already terminated, aborting hangup call.`);
      return;
    }
    await twilioClient.calls(callSid).update({ status: "completed" });
    await callService.updateCall(
      callSid,
      {
        callApplicationStatus: CALL_APPLICATION_STATUS.NA,
        callEndedByWhom: callEndedBy,
        callEndReason: callEndReason,
        callStatus: "completed",
      },
      true
    );
    callService.setCallSid(undefined);
    console.info("twilio: hangup call done.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`twilio: ${reason || "failed to hangup call."}`);
  }
};

const updateInProgessCall = async (
  callSid: string,
  message: AssistantResponse
) => {
  try {
    const { responseType, content } = message;
    if (!callSid) {
      throw Error(
        `twilio: cannot update call, callsid: ${callSid} doesn't exists.`
      );
    }
    if (responseType === ResponseType.END_CALL) {
      //INFO: content is not spoken out if response type is end call
      //TODO: end the call when content is spoken out
      await hangupCall({
        callSid,
        callEndedBy: CALL_ENDED_BY_WHOM.BOT,
        callEndReason: message.content,
      });
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
    const callEndReason = `twilio: ${reason || "Failed to Update Call"} for callsid: ${callSid} with errorCode: ${err.code}.`;
    console.error(callEndReason);
    await hangupCall({
      callSid,
      callEndedBy: CALL_ENDED_BY_WHOM.ERROR,
      callEndReason: callEndReason,
    });
  }
};

const makeacall = async (providerData: Record<string, string>) => {
  try {
    const twilioCallToNumber = providerData.phoneNumber;
    if (!HOST) {
      throw Error("twilio: host address is missing.");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("twilio: call from number is missing.");
    }
    if (!twilioCallToNumber) {
      throw Error("twilio: call to number is missing.");
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
      length: 90,
    });
    const twiml = response.toString();
    const call = await twilioClient.calls.create({
      twiml,
      to: twilioCallToNumber,
      from: TWILIO_FROM_NUMBER,
      record: true,
      statusCallback: `https://${HOST}/callstatusupdate`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    const callService = getCallService();
    callService.setCallSid(call.sid);
    await callService.createCall(call.sid, systemRoleMessage);
    return call.sid;
  } catch (err: $TSFixMe) {
    const reason = err?.message || "failed to make a call";
    console.error(`twilio: ${reason}.`);
    return null;
  }
};

export {
  connectTwilio,
  hangupCall,
  makeacall,
  twilioClient,
  updateInProgessCall,
};
