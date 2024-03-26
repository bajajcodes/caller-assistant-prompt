import { LiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import EventEmitter from "events";
import { createServer } from "http";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { connectDeepgram, deepgramClient } from "service/deepgram";
import { agent, connectOpenAI } from "service/openai";
import { connectRedis } from "service/redis";
import { connectTwilio, updateInProgessCall } from "service/twilio";
import { $TSFixMe } from "types/common";
import { AssistantResponse } from "types/openai";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

let transcriptCollection: Array<string> = [];
const assistantMessages: Array<{
  response: AssistantResponse;
  callSid: string;
}> = [];
const activeCalls: Array<{
  callToNumber: string;
  callSid: string;
  chatMessages: Array<ChatCompletionMessageParam>;
}> = [];
export const messageQueue = new EventEmitter();
export const activeStreamSidMap: Record<string, string> = {};
export const activeCallSidCollection: Array<string> = [];
const port = PORT || 3000;

const enqueueAssistantMessage = (
  assitantResponse: AssistantResponse,
  callSid: string
) => {
  assistantMessages.push({ response: assitantResponse, callSid });
  messageQueue.emit("new_message");
};

export const enqueueActiveCalls = (call: {
  callToNumber: string;
  callSid: string;
  chatMessages: Array<ChatCompletionMessageParam>;
}) => {
  activeCalls.push(call);
};

// export const updateActiveCallStreamSid = ({
//   callSid,
//   streamSid,
// }: {
//   streamSid?: string;
//   callSid: string;
// }) => {
//   const index = activeCalls.findIndex((e) => e.callSid === callSid);
//   activeCalls[index].streamSid = streamSid;
// };

export const getActiveCallChatMessages = (callSid: string) =>
  activeCalls.find((call) => call.callSid === callSid)?.chatMessages;

export const getActiveCallSid = (streamSid: string) =>
  activeStreamSidMap[streamSid];

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
      });
      let messageQueue: Array<Buffer> = [];
      // let deepgramReady = false;

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
          ws.streamSid = streamSid;
          console.info(`Starting Media Stream ${streamSid}`);
          if (!activeStreamSidMap[streamSid]) {
            if (!activeCallSidCollection.includes(callSid)) {
              activeCalls.push({
                callSid: callSid,
                chatMessages: [],
                callToNumber: twilioMessage.start.customParameters.number,
              });
              activeCallSidCollection.push(callSid);
            }
            activeStreamSidMap[streamSid] = callSid;
          }
          console.info(`There are ${activeCalls.length} active calls`);
        }

        if (event === "stop") {
          console.info("Media Stream has Ended.");
          console.info({
            streamSid: twilioMessage.streamSid,
            callSid: twilioMessage.stop.callSid,
          });
        }

        if (event === "media") {
          if (isDeepgramConnectionReady) {
            ws.subscribedStream = twilioMessage.streamSid;
            const media = twilioMessage["media"];
            const audio = Buffer.from(media["payload"], "base64");
            deepgramConnection.send(audio);
          } else {
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
          `Message Queue has total of ${messageQueue.length} messages`
        );
        // deepgramReady = true;
        messageQueue.forEach((msg) => {
          ws.emit("message", msg);
        });
        messageQueue = [];
        deepgramConnection.on(
          LiveTranscriptionEvents.Transcript,
          async (transcription) => {
            const transcript = transcription.channel.alternatives[0].transcript;

            if (transcript) {
              transcriptCollection.push(transcript);
            }
            console.info({ transcript });
            if (transcriptCollection.length < 1 || transcript) {
              return;
            }

            const userInput = transcriptCollection.join("");
            transcriptCollection = [];
            console.info({ userInput });
            agent(
              userInput,
              activeStreamSidMap[ws.streamSid],
              enqueueAssistantMessage
            );
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
        await updateInProgessCall(callSid, message.response);
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
