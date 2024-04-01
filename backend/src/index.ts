import { LiveTranscriptionEvent, LiveTranscriptionEvents } from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { RedisClientType } from "redis";
import { CallService } from "service/call";
import { connectDeepgram, deepgramClient } from "service/deepgram";
import { agent, connectOpenAI } from "service/openai";
import { connectRedis } from "service/redis";
import { connectTwilio, updateInProgessCall } from "service/twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

export const messageQueue = new EventEmitter();
const transcriptCollection: Array<string> = [];
const assistantMessages: Array<{
  response: AssistantResponse;
  callSid: string;
}> = [];
const port = PORT || 3000;
const PUNCTUATION_TERMINATORS = [".", "!", "?"];
let callService: CallService;

export function getCallService(): CallService {
  if (!callService) {
    throw new Error("callservice: not initialized.");
  }
  return callService;
}

export async function initializeCallService(redisClient: RedisClientType) {
  callService = new CallService();
  callService.setRedisClient(redisClient);
}

const enqueueAssistantMessage = (
  assitantResponse: AssistantResponse,
  callSid: string
) => {
  assistantMessages.push({ response: assitantResponse, callSid });
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

            const userInput = transcriptCollection.join("");
            transcriptCollection.splice(0, transcriptCollection.length);
            console.info({ userInput, transcriptCollection });
            agent(userInput, callService.callSid, enqueueAssistantMessage);
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
        const message = assistantMessages.shift();
        const callSid = message?.callSid;
        if (!callSid) {
          console.error(`assistant_messages: call sid is missing.`);
          return;
        }
        if (!message || !message.response.content) {
          console.info(
            "assistant_messages: cannot push empty message to update call."
          );
          return;
        }
        const shouldNotSendPackets = await callService.hasCallFinished(callSid);
        if (shouldNotSendPackets) {
          console.info(
            `assistant_messages: cannot update terminated call: ${callSid} for ${message.response.content}.`
          );
          return;
        }
        await updateInProgessCall(callSid, message.response);
      } else {
        await new Promise((resolve) =>
          messageQueue.once("new_message", resolve)
        );
      }
    }
  } catch (err: $TSFixMe) {
    console.error(
      `assistant_messages: ${err?.message || "Failed to send assistant messages"}.`
    );
  }
};

connectOpenAI();
connectDeepgram();
connectTwilio();
connectRedis();
startServer();
startProcessingAssistantMessages();
