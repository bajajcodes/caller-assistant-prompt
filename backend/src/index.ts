import {
  LiveClient,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
} from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { connectDeepgram, deepgramClient } from "service/deepgram";
import { agent, connectOpenAI } from "service/openai";
import { connectRedis } from "service/redis";
import { connectTwilio, updateInProgessCall } from "service/twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

const assistantMessages: Array<{
  response: AssistantResponse;
  callSid: string;
}> = [];
const messageQueue = new EventEmitter();
const PUNCTUATION_TERMINATORS = [".", "!", "?"];
const port = PORT || 3000;
let currentActiveCallCount = 0;

const enqueueAssistantMessage = (
  assitantResponse: AssistantResponse,
  callSid: string
) => {
  assistantMessages.push({ response: assitantResponse, callSid });
  messageQueue.emit("new_message");
};

export function incrementActiveCallCount() {
  currentActiveCallCount++;
}

export function decrementActiveCallCount() {
  currentActiveCallCount--;
}

function getCurrentActiveCallCount(): number {
  return currentActiveCallCount;
}

const startServer = async () => {
  try {
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    await connectOpenAI();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wss.on("connection", (ws: Record<string, any>) => {
      console.info("New Client Connected");

      const deepgramConnection: LiveClient = deepgramClient.listen.live({
        model: "enhanced-phonecall",
        smart_format: true,
        encoding: "mulaw",
        sample_rate: 8000,
        channels: 1,
        punctuate: true,
        // endpointing: 100,
        // interim_results: true,
        // utterance_end_ms: 1000,
      });
      let messageQueue: Array<Buffer> = [];
      let transcriptCollection: Array<string> = [];

      ws.on("message", (data: $TSFixMe) => {
        const twilioMessage = JSON.parse(data);
        const event = twilioMessage["event"];
        const isDeepgramConnectionReady =
          deepgramConnection.getReadyState() === 1;

        if (event === "connected") {
          console.info("Received a Twilio Connected Event");
        }

        if (event === "start") {
          const streamSid = twilioMessage.streamSid;
          const callSid = twilioMessage.start.callSid;
          //TODO: add streamSid to callSid map
          ws.callSid = callSid;
          console.info(`Starting Media Stream ${streamSid} for ${callSid}`);
          console.info(`There are ${getCurrentActiveCallCount()} active calls`);
        }

        if (event === "media") {
          if (isDeepgramConnectionReady) {
            ws.subscribedStream = twilioMessage.streamSid;
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
              callSid: ws.callSid,
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
              callSid: ws.callSid,
            });
            //TODO: add more strong check of no overallp for streamSid and callSid
            agent(userInput, ws.callSid, enqueueAssistantMessage);
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
      console.info(`There are ${getCurrentActiveCallCount()} active calls`);
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
