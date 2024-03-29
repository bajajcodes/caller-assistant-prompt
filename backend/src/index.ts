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
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
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
        endpointing: 20,
        // interim_results: true,
        // utterance_end_ms: 1000,
      });
      let messageQueue: Array<Buffer> = [];
      let transcriptCollection: Array<string> = [];

      ws.on("message", async (data: $TSFixMe) => {
        const twilioMessage = JSON.parse(data);
        const event = twilioMessage["event"];
        const isDeepgramConnectionReady =
          deepgramConnection.getReadyState() === 1;

        if (event === "connected") {
          console.info("Received a Twilio Connected Event");
        }

        if (event === "start") {
          const callSid = twilioMessage.start.callSid;
          //TODO: add streamSid to callSid map
          ws.connectionLabel = callSid;
          const shouldNotSendPackets =
            await callService.hasCallFinished(callSid);
          if (shouldNotSendPackets) {
            //There is no point in sending more packets if call has finished
            console.info(`Closing WS connection and Call: ${callSid}`);
            // decrementActiveCallCount();
            hangupCall(ws.connectionLabel);
            ws.close();
          }
          const streamSid = twilioMessage.streamSid;
          console.info(`Starting Media Stream ${streamSid} for ${callSid}`);
          // console.info(`There are ${getCurrentActiveCallCount()} active calls`);
        }

        if (event === "media") {
          const shouldNotSendPackets = await callService.hasCallFinished(
            ws.connectionLabel || ""
          );

          if (shouldNotSendPackets) {
            //There is no point in sending more packets if call has finished
            console.info(
              `Closing WS connection and Call: ${ws.connectionLabel}`
            );
            // decrementActiveCallCount();
            hangupCall(ws.connectionLabel);
            ws.close();
          } else if (isDeepgramConnectionReady) {
            const media = twilioMessage["media"];
            const audio = Buffer.from(media["payload"], "base64");
            deepgramConnection.send(audio);
          } else {
            //INFO: messagequeue packets are dropped
            //TODO: use dropped audio packets
            messageQueue.push(data);
          }
        }
      });

      ws.on("close", () => {
        console.info("client has disconnected");
        if (deepgramConnection) {
          deepgramConnection.finish();
        }
      });

      ws.on("error", (err: $TSFixMe) => {
        const message = err?.message || "Something Went Wrong!!";
        if (deepgramConnection) {
          deepgramConnection.finish();
        }
        throw Error(message);
      });

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.info("Deepgram connection is ready and opened.");
        console.info(
          `Message Queue has lost total of ${messageQueue.length} messages`
        );
        if (messageQueue.length > 0) {
          // messageQueue.forEach((msg) => {
          //   ws.emit("message", msg);
          // });
          messageQueue = [];
        }
        deepgramConnection.on(
          LiveTranscriptionEvents.Transcript,
          async (transcription: LiveTranscriptionEvent) => {
            const transcript = transcription.channel.alternatives[0].transcript;
            console.info({
              start: transcription.start,
              duration: transcription.duration,
              // type: transcription.type,
              speech_final: transcription.speech_final,
              is_final: transcription.is_final,
              callSid: ws.connectionLabel,
              // channel_index: transcription.channel_index,
              transcript,
            });

            if (!transcript) {
              return;
            }

            if (transcript && !transcription.speech_final) {
              transcriptCollection.push(transcript);
              return;
            }

            if (
              transcript &&
              transcription.speech_final &&
              !PUNCTUATION_TERMINATORS.includes(transcript.slice(-1))
            ) {
              transcriptCollection.push(transcript);
              return;
            }

            transcriptCollection.push(transcript);
            const userInput = transcriptCollection.join("");
            transcriptCollection = [];
            console.info({
              transcript,
              userInput,
              callSid: ws.connectionLabel,
            });
            agent(userInput, ws.connectionLabel, enqueueAssistantMessage);
          }
        );

        deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
          console.info("Deepgram Connection closed.");
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
        if (!message || !message.response.content) {
          console.info("Cannot Push Empty Message to Update Call.");
          return;
        }
        if (!callSid) {
          console.error("Call Sid is Missing.");
          return;
        }
        updateInProgessCall(callSid, message.response);
      } else {
        await new Promise((resolve) =>
          messageQueue.once("new_message", resolve)
        );
      }
      // console.info(`There are ${getCurrentActiveCallCount()} active calls`);
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
