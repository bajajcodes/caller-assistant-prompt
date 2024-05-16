import EventEmitter from "events";
import twillio, { Twilio } from "twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse, ResponseType } from "types/openai";
import { colorErr, colorUpdate } from "utils/colorCli";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "utils/config";
import { ActiveCallConfig } from "./activecall-service";
import { CallLogKeys, CallLogService } from "./calllog-service";
import { redisClient } from "./redis";

const VoiceResponse = twillio.twiml.VoiceResponse;
export const CALL_TERMINATED_STATUS = [
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
    const status = (await CallLogService.get(
      this.callSid,
      CallLogKeys.CALL_STATUS
    )) as string;

    if (status && CALL_TERMINATED_STATUS.includes(status)) {
      return true;
    }
    return false;
  }

  async endCall() {
    try {
      const isCallTerminated = await this.isCallTerminated();
      if (isCallTerminated) {
        console.info(`twilio: cannot end already terminated call.`);
      } else {
        await this.twilioClient
          .calls(this.callSid)
          .update({ status: "completed" });
        ActiveCallConfig.getInstance().deleteCallConfig();
        this.emit("callended");
      }
    } catch (err: $TSFixMe) {
      console.error(`twilio: ${err?.message || "failed to end call"}`);
    }
  }

  async sendTwiml(
    message: AssistantResponse,
    partialResponseIndex: number,
    icount: number
  ) {
    try {
      const isCallTerminated = await this.isCallTerminated();
      if (isCallTerminated) {
        console.info(`twilio: cannot update terminated call`);
        //TODO: check if it requires to close the connection
        // ws?.close?.();
      } else {
        const response = new VoiceResponse();
        const { responseType, content } = message;

        if (responseType === ResponseType.END_CALL) {
          //TODO: end the call after x miliseconds of silence
          await this.endCall();
        } else {
          if (responseType === ResponseType.SAY_FOR_VOICE) {
            response.say(content);
          } else if (responseType === ResponseType.SEND_DIGITS) {
            const digits = content;
            response.play({ digits });
          }
          const HOST = await redisClient.get("HOST");
          const connect = response.connect();
          console.log({ HOST });
          connect.stream({
            url: `wss://${HOST}`,
            track: "inbound_track",
          });

          response.pause({ length: 90 });

          const twiml = response.toString();
          console.log(colorUpdate(twiml));
          if (twiml && twiml?.trim?.().length) {
            await this.twilioClient.calls(this.callSid).update({ twiml });
            this.emit("twimlsent", partialResponseIndex, icount);
          }
        }
      }
    } catch (err: $TSFixMe) {
      console.error(
        colorErr(`twilio: ${err?.message || "Failed to send twiml"}`)
      );
      console.error(colorErr(err));
      if (err?.code !== 21220) {
        this.endCall();
      }
    }
  }
}
