import { LiveTranscriptionEvent, LiveTranscriptionEvents } from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { RedisClientType } from "redis";
import { CallService } from "service/call";
import { connectDeepgram, deepgramClient } from "service/deepgram";
import { agent, connectOpenAI } from "service/openai";
import { connectRedis } from "service/redis";
import { connectTwilio, hangupCall, updateInProgessCall } from "service/twilio";
import { CALL_ENDED_BY_WHOM } from "types/call";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

const messageQueue = new EventEmitter();
const port = PORT || 3000;
const PUNCTUATION_TERMINATORS = [".", "!", "?"];
let lastSentTime = 0;
let transcriptCollection: Array<string> = [];
let assistantMessages: Array<{
  response: AssistantResponse;
  callSid: string;
}> = [];
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

export function initializeAssistantMessages() {
  assistantMessages = [];
}

const enqueueAssistantMessage = (
  assitantResponse: AssistantResponse,
  callSid: string
) => {
  console.info(`assistant_messages: pushed new assistant response.`);
  assistantMessages.push({ response: assitantResponse, callSid });
  messageQueue.emit("new_message");
};

function sendTranscription() {
  const userInput = transcriptCollection.join("");
  transcriptCollection = [];
  if (userInput.trim().length) {
    console.info({ userInput });
    agent(userInput, callService.callSid, enqueueAssistantMessage);
    lastSentTime = Date.now();
  }
}

async function processTranscription(transcription: LiveTranscriptionEvent) {
  const currentTime = Date.now();
  const transcript = transcription.channel.alternatives[0].transcript.trim();
  console.info(`transcription: ${transcript}`);

  if (!transcript) return;

  if (transcript) {
    transcriptCollection.push(transcript);
  }

  if (
    transcription.speech_final ||
    PUNCTUATION_TERMINATORS.includes(transcript.slice(-1))
  ) {
    sendTranscription();
  } else if (currentTime - lastSentTime >= 3000) {
    console.info(
      `transcription: sending transcription after no transcripts have been sent to the agent within the last 3 seconds.`
    );
    sendTranscription();
  }
}

const startServer = async () => {
  try {
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      console.info("socket: new client connected.");
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
          processTranscription
        );

        deepgramConnection.on(LiveTranscriptionEvents.Close, async () => {
          console.info("deepgram: connection closed.");
          console.info(
            `deepgram: sending remaining transcription when connection is closed.`
          );
          sendTranscription();
        });

        deepgramConnection.addListener(
          LiveTranscriptionEvents.Error,
          async (error) => {
            console.error(
              `deepgram: error recieved, ${error?.message || "something went wrong!!"}`
            );
          }
        );

        deepgramConnection.addListener(
          LiveTranscriptionEvents.Warning,
          async (warning) => {
            console.warn(
              `deepgram: warning received, ${JSON.stringify(warning)}`
            );
          }
        );

        ws.on("message", (data: $TSFixMe) => {
          const twilioMessage = JSON.parse(data);

          if (
            twilioMessage["event"] === "connected" ||
            twilioMessage["event"] === "start"
          ) {
            console.info("socket: received a twilio connected or start event.");
          }

          if (twilioMessage["event"] === "media") {
            const media = twilioMessage["media"];
            const audio = Buffer.from(media["payload"], "base64");
            deepgramConnection.send(audio);
          }
        });

        ws.on("close", () => {
          console.info("socket: client has disconnected.");
          if (deepgramConnection) {
            deepgramConnection.finish();
          }
        });

        ws.on("error", async (err) => {
          const message = err?.message || "something went wrong!!";
          console.error(`socket: ${message}`);
          if (deepgramConnection) {
            deepgramConnection.finish();
          }
          hangupCall({
            callSid: callService.callSid,
            callEndedBy: CALL_ENDED_BY_WHOM.ERROR,
            callEndReason: `socket: connection recieved error, ${callService.callSid || "call sid na"} for ${message}.`,
          });
        });
      });
    });
    console.info(`server: listening on port ${port}.`);
    server.listen(port);
  } catch (err: $TSFixMe) {
    console.error(`server: ${err?.message || "Something went wrong!!"}`);
  }
};

const startProcessingAssistantMessages = async () => {
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.info(`processing_assistant_messages: checking for new message.`);
      if (assistantMessages.length > 0) {
        const message = assistantMessages.shift();
        const callSid = message?.callSid;
        if (!callSid) {
          console.error(`processing_assistant_messages: call sid is missing.`);
          return;
        }
        if (!message || !message.response.content) {
          console.info(
            "processing_assistant_messages: cannot push empty message to update call."
          );
          return;
        }
        console.info(`processing_assistant_messages: found new message.`);
        updateInProgessCall(callSid, message.response);
      } else {
        console.info(`processing_assistant_messages: no new message.`);
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
