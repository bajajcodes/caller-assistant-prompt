import cors from "cors";
import type { Express } from "express";
import express from "express";
import { getCallService } from "index";
import { redisClient } from "service/redis";
import { makeacall } from "service/twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { STORE_KEYS } from "types/redis";

const app: Express = express();

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
  const callSid = req.params.callsid;
  const callService = getCallService();
  const call = await callService.getCall(callSid);
  const callTranscription = call?.callTranscription.filter(
    (transcript) =>
      transcript.role === "user" || transcript.role === "assistant"
  );

  if (!call)
    return res
      .status(404)
      .json({ message: `Call Details not found for CallSid: ${callSid}.` });

  return res.json({
    callSid: call.callSid,
    callStatus: call.callStatus,
    callEndedByWhom: call.callEndedByWhom,
    callEndReason: call.callEndReason,
    callApplicationStatus: call.callApplicationStatus,
    callTranscription,
  });
});

app.post("/makeacall", async (req, res) => {
  try {
    const providerData = req.body;
    const callSid = await makeacall(providerData);
    res.json({
      message: `Call initiated with CallSid: ${callSid}`,
      callSid,
      callInitiated: true,
    });
  } catch (err: $TSFixMe) {
    res.status(400).json({
      message: `twilio: ${err?.message || "failed to initiate call"}.`,
      callInitiated: false,
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
  const callSevice = getCallService();
  //TODO: end call when call status is terminated

  callSevice.updateCall(req.body.CallSid, {
    callStatus: req.body.CallStatus,
  });

  return res.status(200).send();
});

app.post("/callupdate", async (req, res) => {
  console.info({
    callupdate: JSON.stringify(req.body),
  });
  return res.status(200).send();
});

export default app;
