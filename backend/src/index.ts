import { createServer } from "http";
import { GPTService } from "service/gpt-service";
import { connectRedis } from "service/redis";
import { StreamService } from "service/stream-service";
import { TranscriptionService } from "service/transcription-service";
import { connectTwilio } from "service/twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
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

      ws.on("message", (data: $TSFixMe) => {
        const twilioMessage = JSON.parse(data);

        if (twilioMessage["event"] === "start") {
          console.info("socket: received a twilio start event.");
          streamSid = twilioMessage.start.streamSid;
          callSid = twilioMessage.start.callSid;
          streamService.setStreamSid(streamSid);
          streamService.setCallSid(callSid);
          gptService.setCallSid(callSid);
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

      transcriptionService.on("transcription", async (text: string) => {
        if (!text) {
          return;
        }
        console.log(`transcription: ${text}`);
        gptService.completion(text);
      });

      gptService.on("gptreply", async (gptReply: AssistantResponse) => {
        console.log(`gpt: GPT -> TTS: ${gptReply.content}`);
        //TODO: implement any neccessary logic for GPT -> TTS
        streamService.sendTwiml(gptReply);
      });

      streamService.on("twimlsent", () => {
        console.log(`twilio: update has been sent`);
      });

      streamService.on("callended", () => {
        console.log(`twilio: call has ended`);
      });
    });

    console.info(`server: listening on port ${PORT}.`);
    server.listen(PORT);
  } catch (err: $TSFixMe) {
    console.error(`server: ${err?.message || "Something went wrong!!"}`);
  }
};

connectRedis();
startServer();
connectTwilio();
