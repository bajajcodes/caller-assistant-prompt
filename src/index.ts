import { LiveTranscriptionEvents } from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { connectDeepgram } from "service/deepgram";
import { AssistantResponse, agent, connectOpenAI } from "service/openai";
import { connectRedis, redisClient } from "service/redis";
import { connectTwilio, updateInProgessCall } from "service/twilio";
import { $TSFixMe } from "types/common";
import { ResponseType } from "types/openai";
import { STORE_KEYS } from "types/redis";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

let transcriptCollection: Array<string> = [];
const assistantMessages: Array<AssistantResponse> = [];
const messageQueue = new EventEmitter();
const port = PORT || 3000;

const startServer = async () => {
  try {
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    const openaiClient = await connectOpenAI();
    wss.on("connection", (ws) => {
      console.info("New Client Connected");
      const deepgramConnection = connectDeepgram();

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        deepgramConnection.on(
          LiveTranscriptionEvents.Transcript,
          async (transcription) => {
            const transcript = transcription.channel.alternatives[0].transcript;
            console.info({ transcript });

            if (transcript) {
              transcriptCollection.push(transcript);
            }

            if (transcriptCollection.length < 1 || transcript) {
              return;
            }

            const userInput = transcriptCollection.join("");
            transcriptCollection = [];
            console.info({ userInput });
            const assitantResponse = await agent(openaiClient, userInput);
            assistantMessages.push(assitantResponse);
            messageQueue.emit("new_message");
          }
        );

        deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
          console.info("Deepgram Connection closed.");
        });

        ws.on("message", (data: $TSFixMe) => {
          const twilioMessage = JSON.parse(data);

          if (
            twilioMessage["event"] === "connected" ||
            twilioMessage["event"] === "start"
          ) {
            console.info("Received a Twilio Connected or Start Event");
          }

          if (twilioMessage["event"] === "media") {
            const media = twilioMessage["media"];
            const audio = Buffer.from(media["payload"], "base64");
            deepgramConnection.send(audio);
          }
        });

        ws.on("close", () => {
          console.info("client has disconnected");
          if (deepgramConnection) {
            deepgramConnection.finish();
          }
        });

        ws.on("error", (err) => {
          const message = err?.message || "Something Went Wrong!!";
          if (deepgramConnection) {
            deepgramConnection.finish();
          }
          throw Error(message);
        });
      });
    });
    console.info(`Listening on port ${port}`);
    server.listen(port);
  } catch (err) {
    console.error({ err });
  }
};

const startProcessingAssistantMessages = async () => {
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (assistantMessages.length > 0) {
        const callStatus = await redisClient.get(STORE_KEYS.CALL_STATUS);
        const message = assistantMessages.shift();
        console.info({ message, callStatus });
        if (callStatus !== "in-progress") {
          const applicationStatus =
            message?.responseType === ResponseType.END_CALL
              ? message.applicationStatus
              : "NA";
          redisClient.set(STORE_KEYS.APPLICATION_STATUS, applicationStatus);
          console.info("Call is not in-progess cannot update call.");
          return;
        }
        await updateInProgessCall(message!);
      } else {
        await new Promise((resolve) =>
          messageQueue.once("new_message", resolve)
        );
      }
    }
  } catch (err) {
    console.error({ err });
  }
};

connectTwilio();
connectRedis();
startServer();
startProcessingAssistantMessages();
