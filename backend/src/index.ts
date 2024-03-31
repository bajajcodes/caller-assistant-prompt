import {
  LiveClient,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
} from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { CallService } from "service/call";
import { connectDeepgram, deepgramClient } from "service/deepgram";
import { agent, connectOpenAI } from "service/openai";
import { connectRedis, redisClient } from "service/redis";
import { connectTwilio, hangupCall, updateInProgessCall } from "service/twilio";
import { CALL_ENDED_BY_WHOM } from "types/call";
import { $TSFixMe } from "types/common";
import { AssistantResponse, ResponseType } from "types/openai";
import { PORT } from "utils/config";
import WebSocket, { WebSocketServer } from "ws";
import app from "./app";

interface CustomWebSocket extends WebSocket {
  connectionLabel?: string;
}

const assistantMessages: Array<{
  response: AssistantResponse;
  callSid: string;
}> = [];
const messageQueue = new EventEmitter();
const PUNCTUATION_TERMINATORS = [".", "!", "?"];
const port = PORT || 3000;
let callService: CallService;
let previousReponseType: ResponseType;

export function getCallService(): CallService {
  if (!callService) {
    throw new Error("CallService is not initialized");
  }
  return callService;
}

export async function initializeCallService() {
  callService = new CallService();
  await setCallServiceRedisClient();
}

export async function setCallServiceRedisClient() {
  if (!redisClient) {
    throw new Error("Redis client is not connected");
  }
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
    await connectOpenAI();
    await initializeCallService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wss.on("connection", (ws: CustomWebSocket) => {
      console.info("New Client Connected");

      const deepgramConnection: LiveClient = deepgramClient.listen.live({
        model: "enhanced-phonecall",
        smart_format: true,
        encoding: "mulaw",
        sample_rate: 8000,
        channels: 1,
        punctuate: true,
        endpointing: 10,
      });
      let messageQueue: Array<Buffer> = [];
      let transcriptCollection: Array<string> = [];

      ws.on("message", async (data: $TSFixMe) => {
        const twilioMessage = JSON.parse(data);
        const event = twilioMessage["event"];

        if (event === "connected") {
          console.info("Received a Twilio Connected Event");
        }

        if (event === "start") {
          const callSid = twilioMessage.start.callSid;
          ws.connectionLabel = callSid;
          const streamSid = twilioMessage.streamSid;
          console.info(`Starting Media Stream ${streamSid} for ${callSid}`);
        }

        if (event === "media") {
          const isDeepgramConnectionReady =
            deepgramConnection.getReadyState() === 1;
          const media = twilioMessage["media"];
          const audio = Buffer.from(media["payload"], "base64");
          if (isDeepgramConnectionReady) {
            if (messageQueue.length > 0) {
              messageQueue.forEach((msg) => deepgramConnection.send(msg));
              messageQueue = [];
            }
            deepgramConnection.send(audio);
          } else {
            messageQueue.push(audio);
          }
        }
      });

      ws.on("close", () => {
        console.info("client has disconnected");
        if (deepgramConnection) {
          deepgramConnection.finish();
        }
      });

      ws.on("error", async (err: $TSFixMe) => {
        const reason = err?.message || "Something Went Wrong";
        console.error({ error: reason });
        if (ws.connectionLabel) {
          const isCallFinished = await callService.hasCallFinished(
            ws.connectionLabel
          );
          if (!isCallFinished) {
            await hangupCall({
              callSid: ws.connectionLabel,
              callEndedBy: CALL_ENDED_BY_WHOM.ERROR,
              callEndReason: `Websocket Connection Recieved Error: ${ws.connectionLabel || "Call SID NA"} for ${reason}.`,
            });
          }
        }
        if (deepgramConnection) {
          deepgramConnection.finish();
        }
      });

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.info("Deepgram connection is ready and opened.");

        deepgramConnection.on(
          LiveTranscriptionEvents.Transcript,
          async (transcription: LiveTranscriptionEvent) => {
            const transcript = transcription.channel.alternatives[0].transcript;
            const isInterrupt =
              transcription.channel.alternatives[0].confidence > 0.9;
            console.info({ transcript });
            console.info({
              isInterrupt,
              confidence: transcription.channel.alternatives[0].confidence,
              previousReponseType,
            });
            // if (
            //   isInterrupt &&
            //   previousReponseType !== ResponseType.SEND_DIGITS
            // ) {
            //   console.info("Interrupting Bot to get Silent.");
            //   updateInProgessCall(ws.connectionLabel!, {
            //     content: "",
            //     responseType: ResponseType.SAY_FOR_VOICE,
            //   });
            // } else {
            //   console.info("NOT, Interrupting Bot to get Silent.");
            // }

            if (
              transcript &&
              transcription.speech_final &&
              PUNCTUATION_TERMINATORS.includes(transcript.slice(-1))
            ) {
              transcriptCollection.push(transcript);
              const userInput = transcriptCollection.join("");
              transcriptCollection = [];
              console.log({ user: userInput });
              agent(userInput, ws.connectionLabel, enqueueAssistantMessage);
            } else if (
              transcript &&
              (!transcription.speech_final ||
                !PUNCTUATION_TERMINATORS.includes(transcript.slice(-1)))
            ) {
              transcriptCollection.push(transcript);
            }
          }
        );

        deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
          console.info("Deepgram Connection closed.");
        });

        deepgramConnection.on(
          LiveTranscriptionEvents.Error,
          async (err: $TSFixMe) => {
            const reason = err?.message || "Something Went Wrong";
            console.info({ error: reason });
            if (ws.connectionLabel) {
              const isCallFinished = await callService.hasCallFinished(
                ws.connectionLabel
              );
              if (!isCallFinished) {
                await hangupCall({
                  callSid: ws.connectionLabel,
                  callEndedBy: CALL_ENDED_BY_WHOM.ERROR,
                  callEndReason: `Deepgram Connection Recieved Error: ${ws.connectionLabel || "Call SID NA"} for ${reason}.`,
                });
              }
            }
          }
        );
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
        if (!message || !message.response.content) {
          console.info("Cannot Push Empty Message to Update Call.");
          return;
        }
        if (!callSid) {
          console.error("Call Sid is Missing.");
          return;
        }
        const shouldNotSendPackets = await callService.hasCallFinished(callSid);
        if (shouldNotSendPackets) {
          console.info(
            `Cannot Update Terminated Call: ${callSid} for ${message.response.content}`
          );
          return;
        }
        previousReponseType = message.response.responseType;
        updateInProgessCall(callSid, message.response);
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

connectDeepgram();
connectTwilio();
connectRedis();
startServer();
startProcessingAssistantMessages();
