import twillio, { Twilio } from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { activeCallSidCollection, enqueueActiveCalls } from "index";
import { $TSFixMe } from "types/common";
import { ResponseType } from "types/openai";
import { AssistantResponse } from "../types/openai";
import {
  HOST,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "../utils/config";
import { intializeChatMessagesForACall } from "./openai";

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
    await twilioClient.calls(callSid).update({ status: "completed" });
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
      return await hangupCall(callSid);
    }
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
      url: `wss://${HOST}`,
      track: "inbound_track",
    });
    response.pause({
      length: 120,
    });
    const twiml = response.toString();
    await twilioClient.calls(callSid).update({
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

const makeacall = async ({
  twilioCallToNumber,
  providerData,
}: {
  twilioCallToNumber: string;
  providerData: Record<string, string>;
}): Promise<void> => {
  try {
    if (!HOST) {
      throw Error("Host Address is Missing");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("Twillio Call From Number is Missing");
    }
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
    enqueueActiveCalls({
      callSid: call.sid,
      chatMessages: intializeChatMessagesForACall(providerData),
      callToNumber: twilioCallToNumber,
    });
    activeCallSidCollection.push(call.sid);
  } catch (err: $TSFixMe) {
    console.error({ err });
  }
};

const makeCallsInBatch = async (batch: Array<$TSFixMe>) => {
  try {
    batch.forEach((item) =>
      makeacall({ twilioCallToNumber: item.phoneNumber, providerData: item })
    );
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
