import cors from "cors";
import type { Express } from "express";
import express from "express";
import {
  getChatTranscription,
  intializeChatMessages,
  resetChatMessagesAndTranscription,
  resetLLMModelTimer,
} from "service/openai";
import { redisClient } from "service/redis";
import { hangupCall, twilioClient } from "service/twilio";
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
  return res.json({ callStatus });
});

app.get("/applicationstatus", async (_, res) => {
  try {
    const response = await redisClient.get(STORE_KEYS.APPLICATION_STATUS);
    if (!response) return res.json({ applicationStatus: "", content: "" });
    const data = JSON.parse(response);
    const applicationStatus = data.applicationStatus;
    const content = data.content;
    return res.json({ applicationStatus, content });
  } catch (err: $TSFixMe) {
    console.error(
      `Failed to send Applicaiton Status: ${err?.message || "Something Went Wrong"}`
    );
    return res.status(400).json({ applicationStatus: "", content: "" });
  }
});

app.get("/transcription", (_, res) => {
  const transcription = getChatTranscription();
  res.json({ transcription });
});

app.post("/reset", (_, res) => {
  resetLLMModelTimer();
  resetChatMessagesAndTranscription();
  redisClient.set(STORE_KEYS.CALL_SID, "");
  redisClient.set(STORE_KEYS.PROVIDER_DATA, "");
  redisClient.set(STORE_KEYS.APPLICATION_STATUS, "");
  redisClient.set(STORE_KEYS.CALL_STATUS, "");
  return res.json({ done: true });
});

app.post("/hangup", async (_, res) => {
  const callSid = await redisClient.get(STORE_KEYS.CALL_SID);
  if (callSid) {
    await hangupCall(callSid);
    return res.json({ done: true });
  }
  // resetLLMModelTimer();
  // resetChatMessagesAndTranscription();
  // redisClient.set(STORE_KEYS.CALL_SID, "");
  // redisClient.set(STORE_KEYS.PROVIDER_DATA, "");
  // redisClient.set(STORE_KEYS.APPLICATION_STATUS, "");
  // redisClient.set(STORE_KEYS.CALL_STATUS, "");
  // redisClient.set(STORE_KEYS.CALL_HANGUP, "false");
  return res.json({ done: false });
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
    const providerDataStringified = JSON.stringify(providerData);
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
    resetLLMModelTimer();
    intializeChatMessages(providerDataStringified);
    redisClient.set(STORE_KEYS.CALL_SID, call.sid);
    redisClient.set(STORE_KEYS.PROVIDER_DATA, providerDataStringified);
    redisClient.set(STORE_KEYS.APPLICATION_STATUS, "");
    redisClient.set(STORE_KEYS.CALL_STATUS, "");
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
  redisClient.set(STORE_KEYS.CALL_STATUS, req.body.CallStatus);
  return res.status(200).send();
});

export default app;
