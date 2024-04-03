import { createServer } from "http";
import { connectRedis } from "service/redis";
import { $TSFixMe } from "types/common";
import { PORT } from "utils/config";
import { WebSocketServer } from "ws";
import app from "./app";

const startServer = async () => {
  try {
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      console.info("socket: new client connected.");

      ws.on("message", (data: $TSFixMe) => {
        const twilioMessage = JSON.parse(data);

        if (twilioMessage["event"] === "start") {
          console.info("socket: received a twilio start event.");
          // TODO: Implement the logic for handling the "start" event
        }

        if (twilioMessage["event"] === "media") {
          console.info("socket: received a twilio media event.");
          const media = twilioMessage["media"];
          const audio = Buffer.from(media["payload"], "base64");
          console.info({ audio });
          // TODO: Process the audio data (e.g., send it to Deepgram for transcription)
        }

        if (twilioMessage["event"] === "stop") {
          console.info("socket: received a twilio stop event.");
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
    });
    console.info(`server: listening on port ${PORT}.`);
    server.listen(PORT);
  } catch (err: $TSFixMe) {
    console.error(`server: ${err?.message || "Something went wrong!!"}`);
  }
};

connectRedis();
startServer();
