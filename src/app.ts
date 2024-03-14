import cors from "cors";
import type { Express } from "express";
import express from "express";
import { redisClient } from "service/redis";
import { twilioClient } from "service/twilio";
import twillio from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { STORE_KEYS } from "types/redis";
import { TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER } from "utils/config";

const VoiceResponse = twillio.twiml.VoiceResponse;

const app: Express = express();

//TODO: allow set of origins
app.use(cors());
app.use(express.urlencoded({ extended: false }));

app.use((req, _, next) => {
  //TODO: check if it is better to use from env variables
  redisClient.set(STORE_KEYS.HOST, req.headers.host!);
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  // const wsProtocol = protocol === "https" ? "wss" : "ws";
  const wsProtocol = "wss";
  req.headers.protocol = protocol;
  req.headers.wsProtocol = wsProtocol;
  console.info({ protocol, wsProtocol, host: req.headers.host });
  next();
});

app.get("/", (_, res) =>
  res.type("text").send("Hello World 👋, from Caller Assistant!!"),
);

app.get("/makeacall", async (req, res) => {
  try {
    if (!TWILIO_TO_NUMBER) {
      throw Error("Call To Number is Missing");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("Call From Number is Missing");
    }
    const protocol = req.headers.protocol;
    const wsProtocol = req.headers.wsProtocol;
    const response = new VoiceResponse();
    const connect = response.connect();
    response.say("");
    connect.stream({
      url: `${wsProtocol}://${req.headers.host}`,
      track: "inbound_track",
    });
    response.pause({
      length: 120,
    });
    console.info({ host: req.headers.host });
    const twiml = response.toString();
    const call = await twilioClient.calls.create({
      twiml: twiml,
      to: TWILIO_TO_NUMBER,
      from: TWILIO_FROM_NUMBER,
      statusCallback: `${protocol}://${req.headers.host}/call-update`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      record: true,
    });
    redisClient.set(STORE_KEYS.CALL_SID, call.sid);
    res.send(`Call initiated with SID: ${call.sid}`);
  } catch (err: $TSFixMe) {
    res.status(400).send(err?.message || "Failed to create call");
  }
});

app.post("/recieveacall", async (req, res) => {
  const wsProtocol = req.headers.wsProtocol;
  const callSid = req.body?.CallSid;
  redisClient.set(STORE_KEYS.CALL_SID, callSid);
  console.info({ callSid });
  console.info(req.headers.host);
  const response = new VoiceResponse();
  const connect = response.connect();
  response.say("Speak to see your audio transcribed in the console.");
  connect.stream({
    url: `${wsProtocol}://${req.headers.host}`,
    track: "inbound_track",
  });
  const twiml = response.toString();
  res.type("xml").send(twiml);
});

app.post("/call-update", (req, res) => {
  console.info(
    "Call Status Update:",
    req.body.CallStatus,
    "for Call SID:",
    req.body.CallSid,
  );
  redisClient.set(STORE_KEYS.CALL_STATUS, req.body.CallStatus);
  return res.status(200).send();
});

export default app;
