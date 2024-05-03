import { createServer } from "http";
import { isCallTransfered } from "scripts/iscall-transfered";
import { ActiveCallConfig } from "service/activecall-service";
import { GPTService } from "service/gpt-service";
import { IVRService } from "service/ivr-service";
import { connectRedis } from "service/redis";
import { StreamService } from "service/stream-service";
import { TranscriptionService } from "service/transcription-service";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
import { colorErr, colorInfo, colorSuccess, colorUpdate } from "utils/colorCli";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

const startServer = async () => {
  try {
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      let streamSid: string = "";
      let callSid: string = "";

      console.info("socket: new client connected.");

      //TODO: pass ws to all services to close the ws connection on close/error
      //TOOD: end the call on error
      //TODO: end the call if status is terminated
      const streamService = new StreamService(ws);
      const transcriptionService = new TranscriptionService();
      const gptService = new GPTService();
      const ivrService = new IVRService([
        {
          intent: "Reason for your Call",
          response: "credentialing",
          triggers: ["reason for your call"],
        },
        {
          intent: "Confirm Reason for Call",
          response: "credentialing",
          triggers: ["calling about credentialing"],
        },
        {
          intent: "Calling For",
          response: "credentialing",
          triggers: ["say credentialing"],
        },
      ]);

      ws.on("message", (data: $TSFixMe) => {
        const twilioMessage = JSON.parse(data);

        if (twilioMessage["event"] === "start") {
          console.info("socket: received a twilio start event.");
          streamSid = twilioMessage.start.streamSid;
          callSid = twilioMessage.start.callSid;
          streamService.setStreamSid(streamSid);
          streamService.setCallSid(callSid);
          gptService.setCallSid(callSid);
          ivrService.setCallSid(callSid);
          console.log(`socket -> Starting Media Stream for ${streamSid}`);
        }

        if (twilioMessage["event"] === "media") {
          const media = twilioMessage["media"];
          const payload = media["payload"];
          transcriptionService.send(payload);
        }

        if (twilioMessage["event"] === "stop") {
          console.info("socket: received a twilio stop event.");
          console.log(`socket -> Media stream ${streamSid} ended.`);
          // TODO: Implement the logic for handling the "stop" event
        }
      });

      ws.on("close", () => {
        console.info("socket: client has disconnected.");
        // TODO: Implement any necessary cleanup or termination logic
      });

      ws.on("error", async (err) => {
        console.info("socket: client has recieved error.");
        const message = err?.message || "something went wrong!!";
        console.error(`socket: ${message}`);
        // TODO: Implement any necessary cleanup or termination logic
      });

      transcriptionService.on("utterance", async (text: string) => {
        // This is a bit of a hack to filter out empty utterances
        if (text?.length > 5) {
          console.log(colorErr("Twilio -> Interruption, Clearing stream"));
          console.log(colorErr(text));
          ws.send(
            JSON.stringify({
              streamSid,
              event: "clear",
            })
          );
        }
      });

      transcriptionService.on("transcription", async (text: string) => {
        if (!text) {
          return;
        }
        console.log(colorSuccess(`transcription: ${text}`));
        if (
          ActiveCallConfig.getInstance().getCallConfig()
            ?.isLastIvrMenuOptionUsed &&
          !ActiveCallConfig.getInstance().getCallConfig()
            ?.isIVRNavigationCompleted
        ) {
          isCallTransfered(text).then((isTransfered) => {
            if (!isTransfered) return;
            ActiveCallConfig.getInstance().setIVRNavigationCompleted();
          });
        }
        if (
          ActiveCallConfig.getInstance().getCallConfig()
            ?.isIVRNavigationCompleted
        ) {
          gptService.completion(text);
        } else {
          ivrService.handleResponse(text);
        }
        console.log(
          colorUpdate(
            `isIVRNavigationCompleted: ${
              ActiveCallConfig.getInstance().getCallConfig()
                ?.isIVRNavigationCompleted
            }`
          )
        );
      });

      transcriptionService.on("transcriptionerror", () => {
        streamService.endCall();
      });

      gptService.on("gptreply", async (gptReply: AssistantResponse) => {
        console.log(colorInfo(`gpt: GPT -> TTS: ${gptReply.content}`));
        console.log(colorInfo(`gpt: response-type:${gptReply.responseType}`));
        streamService.sendTwiml(gptReply);
      });

      gptService.on("gpterror", () => {
        streamService.endCall();
      });

      ivrService.on("ivrreply", async (ivrReply: AssistantResponse) => {
        console.log(colorInfo(`ivrservice: IVR -> TTS: ${ivrReply.content}`));
        console.log(
          colorInfo(`ivrservice: response-type:${ivrReply.responseType}`)
        );
        streamService.sendTwiml(ivrReply);
      });

      streamService.on("twimlsent", () => {
        console.log(`twilio: update has been sent`);
      });

      streamService.on("callended", () => {
        console.log(`twilio: call has ended`);
        ws?.close?.();
      });
    });

    wss.on("error", (err) => {
      console.error(
        colorErr(
          `Message: ${err?.message} Cause: ${err?.cause} Name: ${err.name}`
        )
      );
    });

    console.info(`server: listening on port ${PORT}.`);
    server.listen(PORT);
  } catch (err: $TSFixMe) {
    console.error(`server: ${err?.message || "Something went wrong!!"}`);
  }
};

connectRedis();
startServer();
