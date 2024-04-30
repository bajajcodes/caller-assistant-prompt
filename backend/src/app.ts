import cors from "cors";
import type { Express } from "express";
import express from "express";
import { hangupCall } from "scripts/hangup-call";
import { makeOutboundCall } from "scripts/outbound-call";
import { ActiveCallConfig } from "service/activecall-service";
import { redisClient } from "service/redis";
import { Message } from "types/call";
import { MODELS } from "types/openai";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { STORE_KEYS } from "types/redis";

const app: Express = express();

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("dist"));

app.use(async (req, _, next) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  req.headers.protocol = protocol;
  req.headers.wsProtocol = wsProtocol;
  await redisClient.set(STORE_KEYS.HOST, req.headers.host!);
  next();
});

app.get("/", (_, res) => res.send("Hello World 👋, from Caller Assistant!!"));

app.get("/calllog/:callsid", async (req, res) => {
  const sid = req.params.callsid;
  const status = await redisClient.get(`${sid}__callstatus`);
  const callTranscription = await redisClient.lRange(
    `${sid}__transcription`,
    0,
    -1
  );
  const callIVRTranscription = await redisClient.lRange(
    `${sid}__ivr--transcription`,
    0,
    -1
  );
  if (!status && !callTranscription) {
    return res
      .status(404)
      .json({ message: `Call Details not found for CallSid: ${sid}.` });
  }
  const transcriptionParsed = callTranscription.map(
    (message) => JSON.parse(message) as Message
  );
  const ivrParsed = callIVRTranscription.map(
    (message) => JSON.parse(message) as Message
  );
  const transcription = transcriptionParsed.filter(
    (transcript) =>
      transcript.role === "user" || transcript.role === "assistant"
  );
  const ivrTranscription = ivrParsed.filter(
    (transcript) =>
      transcript.role === "user" || transcript.role === "assistant"
  );

  return res.json({
    sid,
    status,
    transcription,
    ivrTranscription,
  });
});

app.post("/makeoutboundcall", async (req, res) => {
  try {
    console.log(req.body);
    const call = await makeOutboundCall(req.body.phoneNumber as string);

    if (call?.sid) {
      await redisClient.set(
        `${call.sid}__providerdata`,
        JSON.stringify(req.body)
      );
      ActiveCallConfig.getInstance().setCallConfig(
        call.sid,
        MODELS.GPT_4_TUBRO,
        1000
      );
      res.json({
        message: `Call initiated`,
        callSid: call.sid,
      });
    } else {
      res.status(400).json({
        message: "Failed to initiate the call.",
        callSid: null,
      });
    }
  } catch (err: unknown) {
    console.error(err);
    res.status(400).json({
      message: `twilio: ${(err as Error)?.message || "failed to initiate call"}.`,
      callSid: null,
    });
  }
});

app.post("/callstatusupdate", async (req, res) => {
  console.info(
    "Call Status Update:",
    req.body.CallStatus,
    "for Call SID:",
    req.body.CallSid
  );
  redisClient.set(`${req.body.CallSid}__callstatus`, req.body.CallStatus);
  return res.status(200).send();
});

app.post("/hangupcall", async (req, res) => {
  const callSid = req.body.callSid;
  try {
    await hangupCall(callSid);
    return res.status(200).send();
  } catch (err) {
    return res.status(400).send();
  }
});

export default app;
