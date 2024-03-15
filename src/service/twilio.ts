import twillio, { Twilio } from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { ResponseType } from "types/openai";
import { STORE_KEYS } from "types/redis";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../utils/config";
import { AssistantResponse, EndCallResponse } from "./openai";
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
    console.info("Connected to Twilio Client");
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Update Call";
    throw Error(message);
  }
};

const getCallSid = async () => await redisClient.get(STORE_KEYS.CALL_SID);

const hangupCall = async (message: EndCallResponse) => {
  try {
    const callSid = await getCallSid();
    if (!callSid) {
      console.info(
        `Cannot hangup call, Because CallSid: ${callSid} does not exists.`
      );
      return;
    }
    await redisClient.set(
      STORE_KEYS.APPLICATION_STATUS,
      message.applicationStatus
    );
    console.info(`Application Status: ${message.applicationStatus}`);
    console.info("Hangup Call.");
    return await twilioClient.calls(callSid).update({ status: "completed" });
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Update Call";
    throw Error(message);
  }
};

const updateInProgessCall = async (message: AssistantResponse) => {
  try {
    const { responseType, content } = message;
    const callSid = await getCallSid();
    if (!callSid) {
      throw Error(`Cannot Update Call, CallSid: ${callSid} Doesn't Exists.`);
    }
    if (responseType === ResponseType.END_CALL) {
      return await hangupCall(message as EndCallResponse);
    }
    const host = await redisClient.get(STORE_KEYS.HOST);
    const response = new VoiceResponse();
    if (responseType === ResponseType.SAY_FOR_VOICE) {
      response.say(content);
    }
    if (responseType === ResponseType.SEND_DIGITS) {
      const digits = content
        .split("")
        .map((digit) => `w${digit}`)
        .join("");
      response.play({
        digits,
      });
    }
    const connect = response.connect();
    connect.stream({
      url: `wss://${host}`,
      track: "inbound_track",
    });
    response.pause({
      length: 120,
    });
    const twiml = response.toString();
    console.info({ twiml });
    return await twilioClient.calls(callSid).update({
      twiml,
    });
  } catch (err: $TSFixMe) {
    const message = err?.message || ("Failed to Update Call" as string);
    if (err?.code == 21220) {
      console.error({ message, code: err.code });
      //TODO: add more strong error handling here
      return;
    }
    throw Error(message);
  }
};

export { connectTwilio, hangupCall, twilioClient, updateInProgessCall };
