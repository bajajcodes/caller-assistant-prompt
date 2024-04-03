import EventEmitter from "events";
import twillio, { Twilio } from "twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse, ResponseType } from "types/openai";
import { HOST, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "utils/config";
import { redisClient } from "./redis";

const VoiceResponse = twillio.twiml.VoiceResponse;
const CALL_TERMINATED_STATUS = [
  "completed",
  "busy",
  "failed",
  "no-answer",
  "canceled",
];

export class StreamService extends EventEmitter {
  private ws: WebSocket;
  private streamSid: string;
  private callSid: string;
  private twilioClient: Twilio;
  constructor(ws: $TSFixMe) {
    super();
    this.ws = ws;
    this.streamSid = "";
    this.callSid = "";
    this.twilioClient = new twillio.Twilio(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN
    );
  }

  setStreamSid(streamSid: string) {
    this.streamSid = streamSid;
  }

  setCallSid(callSid: string) {
    this.callSid = callSid;
  }

  async isCallTerminated() {
    const callStatusKey = `${this.callSid}__callstatus`;
    const callStatus = await redisClient.get(callStatusKey);

    if (callStatus && CALL_TERMINATED_STATUS.includes(callStatus)) {
      return true;
    }
    return false;
  }

  async endCall() {
    const isCallTerminated = await this.isCallTerminated();
    if (isCallTerminated) {
      console.info(`twilio: cannot end already terminated call.`);
    } else {
      await this.twilioClient
        .calls(this.callSid)
        .update({ status: "completed" });
      this.emit("callended");
    }
  }

  async sendTwiml(message: AssistantResponse) {
    const isCallTerminated = await this.isCallTerminated();
    if (isCallTerminated) {
      console.info(`twilio: cannot update terminated call`);
    } else {
      const response = new VoiceResponse();
      const { responseType, content } = message;

      if (responseType === ResponseType.END_CALL) {
        await this.endCall();
      } else {
        if (responseType === ResponseType.SAY_FOR_VOICE) {
          response.say(content);
        } else if (responseType === ResponseType.SEND_DIGITS) {
          const digits = content;
          response.play({ digits });
        }
        const connect = response.connect();
        connect.stream({
          url: `wss://${HOST}`,
          track: "inbound_track",
        });

        response.pause({ length: 90 });

        const twiml = response.toString();

        await this.twilioClient.calls(this.callSid).update({ twiml });
        this.emit("twimlsent");
      }
    }
  }
}
