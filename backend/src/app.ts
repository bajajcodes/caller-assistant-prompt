import cors from "cors";
import type { Express } from "express";
import express from "express";
import { getChatMessages, intializeChatMessages } from "service/openai";
import { redisClient } from "service/redis";
import { twilioClient } from "service/twilio";
import twillio from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { STORE_KEYS } from "types/redis";
import { TWILIO_FROM_NUMBER } from "utils/config";

const VoiceResponse = twillio.twiml.VoiceResponse;
const app: Express = express();

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("build"));

app.use(async (req, _, next) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  req.headers.protocol = protocol;
  req.headers.wsProtocol = wsProtocol;
  await redisClient.set(STORE_KEYS.HOST, req.headers.host!);
  next();
});

app.get("/", (_, res) => res.send("Hello World 👋, from Caller Assistant!!"));

app.get("/callstatus", async (_, res) => {
  const callStatus = await redisClient.get(STORE_KEYS.CALL_STATUS);
  if (callStatus === "completed") {
    const applicationStatus = await redisClient.get(
      STORE_KEYS.APPLICATION_STATUS
    );
    console.info({ applicationStatus });
  }
  return res.json({ callStatus });
});

app.get("/transcription", (_, res) => {
  const chatMessages = getChatMessages();
  res.json({ transcription: chatMessages });
});

app.post("/makeacall", async (req, res) => {
  try {
    const twilioCallToNumber = req.body.twilioCallToNumber;
    const providerData = req.body.providerData;
    if (!twilioCallToNumber || !providerData) {
      throw Error("Call To Number or Provider Data is Missing");
    }
    if (!TWILIO_FROM_NUMBER) {
      throw Error("Call From Number is Missing");
    }
    const response = new VoiceResponse();
    const connect = response.connect();
    response.say("");
    connect.stream({
      url: `${req.headers.wsProtocol}://${req.headers.host}`,
      track: "inbound_track",
    });
    response.pause({
      length: 120,
    });
    const twiml = response.toString();
    const call = await twilioClient.calls.create({
      twiml,
      to: twilioCallToNumber,
      from: TWILIO_FROM_NUMBER,
      record: true,
      statusCallback: `${req.headers.protocol}://${req.headers.host}/callupdate`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    // await redisClient.hSet(call.sid, {
    //   providerData,
    //   callSid: call.sid,
    //   callStatus: "",
    //   applicationStatus: "",
    // });
    redisClient.set(STORE_KEYS.CALL_SID, call.sid);
    redisClient.set(STORE_KEYS.PROVIDER_DATA, providerData);
    intializeChatMessages(providerData);
    console.info(`Call initiated with SID: ${call.sid}`);
    res.json({
      message: `Call initiated with SID: ${call.sid}`,
      callSid: call.sid,
      callInitiated: true,
    });
  } catch (err: $TSFixMe) {
    console.error({ err });
    res.status(400).json({
      message: "Failed to initiate call",
      callInitiated: false,
    });
  }
});

app.post("/callupdate", async (req, res) => {
  console.info(
    "Call Status Update:",
    req.body.CallStatus,
    "for Call SID:",
    req.body.CallSid
  );
  // const call = await redisClient.hGetAll(req.body.callSid);
  // await redisClient.hSet(call.callSid, {
  //   ...call,
  //   callStatus: req.body.CallStatus,
  // });
  redisClient.set(STORE_KEYS.CALL_STATUS, req.body.CallStatus);
  return res.status(200).send();
});

export default app;
