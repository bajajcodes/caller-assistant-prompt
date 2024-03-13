import twillio, { Twilio } from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { ResponseType } from "types/openai";
import { STORE_KEYS } from "types/redis";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../utils/config";
import { AssistantResponse } from "./openai";
import { redisClient } from "./redis";

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
    console.info("Twilio Account connected");
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Update Call";
    throw Error(message);
  }
};

const getCallSid = async () => await redisClient.get(STORE_KEYS.CALL_SID);

const hangupCall = async () => {
  try {
    const callSid = await getCallSid();
    if (!callSid) {
      console.info(
        `Cannot hangup call, Because CallSid: ${callSid} does not exists.`,
      );
      return;
    }
    return await twilioClient.calls(callSid).update({ status: "completed" });
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Update Call";
    throw Error(message);
  }
};

const updateInProgessCall = async ({
  content,
  responseType,
}: AssistantResponse) => {
  try {
    if (responseType === ResponseType.END_CALL) {
      return await hangupCall();
    }
    const response = new VoiceResponse();
    if (responseType === ResponseType.SAY_FOR_VOICE) {
      response.say(content);
    }
    if (responseType === ResponseType.SEND_DIGITS) {
      response.play({
        digits: `ww${content}`,
      });
    }
    const connect = response.connect();
    //TODO: replace host here
    connect.stream({
      url: "wss://localhost:3000",
      track: "inbound_track",
    });
    response.pause({
      length: 60,
    });
    const twiml = response.toString();
    const callSid = await getCallSid();
    if (!callSid) {
      throw Error(`Cannot Update Call, CallSid: ${callSid} Doesn't Exists.`);
    }
    return await twilioClient.calls(callSid).update({
      twiml,
    });
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Update Call";
    throw Error(message);
  }
};

export { connectTwilio, hangupCall, twilioClient, updateInProgessCall };
