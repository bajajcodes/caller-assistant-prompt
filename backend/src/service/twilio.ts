import twillio, { Twilio } from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { ResponseType } from "types/openai";
import { STORE_KEYS } from "types/redis";
import { AssistantResponse } from "../types/openai";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../utils/config";
import { applicationStatusAgent } from "./openai";
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
    console.info("Connected to Twilio Client.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({ message: "Failed To Connect Twilio Client.", reason });
    throw err;
  }
};

const hangupCall = async (callSid?: string | null) => {
  try {
    if (!callSid) {
      console.info(
        `Cannot hangup call, Because CallSid: ${callSid} does not exists.`
      );
      return;
    }
    console.info("Calling GET: application status");
    const applicationStatus = await applicationStatusAgent();
    console.info(`Application Status: ${applicationStatus || "--"}`);
    redisClient.set(STORE_KEYS.APPLICATION_STATUS, applicationStatus || "");
    console.info("Hangup Call Done.");
    return await twilioClient.calls(callSid).update({ status: "completed" });
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
      return await hangupCall(callSid);
    }
    const host = await redisClient.get(STORE_KEYS.HOST);
    const response = new VoiceResponse();
    if (responseType === ResponseType.SAY_FOR_VOICE) {
      response.say(content);
    }
    if (responseType === ResponseType.SEND_DIGITS) {
      const digits = content
        .split("")
        .map((digit) => `${digit === "#" ? "" : "w"}${digit}`)
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
    return await twilioClient.calls(callSid).update({
      twiml,
    });
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({ reason, message: "Failed to Update Call" });
    if (err?.code == 21220) {
      console.error({
        message: "Failed to Update Call",
        code: err.code,
        callSid,
        reason,
      });
      await hangupCall(callSid);
      return;
    }
    throw err;
  }
};

export { connectTwilio, hangupCall, twilioClient, updateInProgessCall };
