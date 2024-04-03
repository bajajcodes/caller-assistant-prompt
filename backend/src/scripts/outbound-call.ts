import twillio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import {
  HOST,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "utils/config";

export const makeOutboundCall = async (callTo: string) => {
  try {
    if (!HOST) {
      throw Error("twilio: host address is missing.");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("twilio: call from number is missing.");
    }
    if (!callTo) {
      throw Error("twilio: call to number is missing.");
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
    const client = new twillio.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const twiml = response.toString();
    const call = await client.calls.create({
      twiml,
      to: callTo,
      from: TWILIO_FROM_NUMBER,
      record: true,
      statusCallback: `https://${HOST}/callstatusupdate`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    return call;
  } catch (err: $TSFixMe) {
    const reason = err?.message || "failed to make a call";
    console.error(`twilio: ${reason}.`);
    return null;
  }
};
