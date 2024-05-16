import twillio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "utils/config";

export const makeOutboundCall = async ({
  callTo,
  hostname,
  isHTTPS,
}: {
  callTo: string;
  hostname: string;
  isHTTPS: boolean;
}) => {
  try {
    if (!hostname) {
      throw Error("host address is missing.");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("call from number is missing.");
    }
    if (!callTo) {
      throw Error("call to phone number is missing.");
    }
    const wsUrl = `${isHTTPS ? "wss" : "ws"}://${hostname}`;
    const serverUrl = `${isHTTPS ? "https" : "http"}://${hostname}/callstatusupdate`;
    console.log({ wsUrl, serverUrl });
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
