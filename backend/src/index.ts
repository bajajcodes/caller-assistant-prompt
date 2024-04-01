import { LiveTranscriptionEvent, LiveTranscriptionEvents } from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { connectDeepgram, deepgramClient } from "service/deepgram";
import { agent, connectOpenAI } from "service/openai";
import { connectRedis, redisClient } from "service/redis";
import { connectTwilio, hangupCall, updateInProgessCall } from "service/twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
import { STORE_KEYS } from "types/redis";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

const transcriptCollection: Array<string> = [];
const assistantMessages: Array<AssistantResponse> = [];
export const messageQueue = new EventEmitter();
const port = PORT || 3000;
const PUNCTUATION_TERMINATORS = [".", "!", "?"];

const enqueueAssistantMessage = (assitantResponse: AssistantResponse) => {
  assistantMessages.push(assitantResponse);
  messageQueue.emit("new_message");
};

const startServer = async () => {
  try {
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      console.info("New Client Connected");
      const deepgramConnection = deepgramClient.listen.live({
        model: "enhanced-phonecall",
        smart_format: true,
        encoding: "mulaw",
        sample_rate: 8000,
        channels: 1,
        punctuate: true,
      });

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        deepgramConnection.on(
          LiveTranscriptionEvents.Transcript,
          async (transcription: LiveTranscriptionEvent) => {
            const transcript = transcription.channel.alternatives[0].transcript;

            if (!transcript) return;

            if (transcript) {
              console.info({
                transcript,
              });
              transcriptCollection.push(transcript);
            }

            if (
              !transcription.speech_final ||
              !PUNCTUATION_TERMINATORS.includes(transcript.slice(-1))
            ) {
              return;
            }

            // if (
            //   transcription.speech_final &&
            //   PUNCTUATION_TERMINATORS.includes(transcript.slice(-1))
            // ) {
            const userInput = transcriptCollection.join("");
            transcriptCollection.splice(0, transcriptCollection.length);
            console.info({ userInput, transcriptCollection });
            console.info({
              IS_SPEECH_FINAL: transcription.speech_final,
              IS_PUNCTUATION_TERMINATORS: PUNCTUATION_TERMINATORS.includes(
                transcript.slice(-1)
              ),
            });
            await agent(userInput, enqueueAssistantMessage);
            // }
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
      const callSid = await redisClient.get(STORE_KEYS.CALL_SID);
      const callStatus = await redisClient.get(STORE_KEYS.CALL_STATUS);
      console.info({ callStatus });
      if (callStatus === "completed") {
        return await hangupCall(callSid);
      }

      if (callSid && assistantMessages.length > 0) {
        const message = assistantMessages.shift();
        if (!message || !message.content) {
          console.info("Cannot Push Empty Message to Update Call");
          return;
        }
        await updateInProgessCall(callSid, message);
      } else {
        await new Promise((resolve) =>
          messageQueue.once("new_message", resolve)
        );
      }
      if (!callSid) {
        console.error("Call Sid is Missing.");
      }
    }
  } catch (err) {
    console.error({ err });
  }
};

connectOpenAI();
connectDeepgram();
connectTwilio();
connectRedis();
startServer();
startProcessingAssistantMessages();
