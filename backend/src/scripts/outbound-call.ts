import twillio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import {
  SERVER,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "utils/config";

export const makeOutboundCall = async ({
  callTo,
}: {
  callTo: string;
  isHTTPS: boolean;
}) => {
  try {
    if (!SERVER) {
      throw Error("host address is missing.");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("call from number is missing.");
    }
    if (!callTo) {
      throw Error("call to phone number is missing.");
    }
    // const wsUrl = `${isHTTPS ? "wss" : "ws"}://${SERVER}`;
    // const serverUrl = `${isHTTPS ? "https" : "http"}://${SERVER}/callstatusupdate`;
    const wsUrl = `wss://${SERVER}`;
    const serverUrl = `https://${SERVER}/callstatusupdate`;
    const response = new VoiceResponse();
    const connect = response.connect();
    response.say("");
    connect.stream({
      url: wsUrl,
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
      recordingChannels: "dual",
      statusCallback: serverUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    return call;
  } catch (err: $TSFixMe) {
    const reason = err?.message || "failed to make a call";
    console.error(reason);
    throw err;
  }
};
