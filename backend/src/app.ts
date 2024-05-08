import cors from "cors";
import type { Express } from "express";
import express from "express";
import { hangupCall } from "scripts/hangup-call";
import { makeOutboundCall } from "scripts/outbound-call";
import { ActiveCallConfig } from "service/activecall-service";
import { redisClient } from "service/redis";
import { Message } from "types/call";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { STORE_KEYS } from "types/redis";
import { CallData, isValidCallData, updateIVRMenus } from "utils/api";
import { colorErr } from "utils/colorCli";

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
    //TODO: find solution for for newlines and ' characters formatting
    const providerDataString = (req.body.providerData as string)
      .replaceAll("\n", "")
      .replaceAll("\n'", "");
    const ivrMenuString = (req.body.ivrMenu as string)
      .replaceAll("\n", "")
      .replaceAll("\n'", "");
    const plainProviderData = JSON.parse(providerDataString);
    const plainIvrMenu = JSON.parse(ivrMenuString);
    const callData = {
      providerData: plainProviderData,
      ivrMenu: plainIvrMenu,
    } as CallData;
    const { isValid, message } = isValidCallData(callData);
    if (!isValid) {
      return res.status(400).json({ message, callSid: null });
    }
    const call = await makeOutboundCall(callData.providerData.phoneNumber);

    if (!call.sid) {
      return res
        .status(400)
        .json({ message: "Failed to initiate the call.", callSid: null });
    }
    callData.ivrMenu = updateIVRMenus(callData);

    ActiveCallConfig.getInstance().setCallConfig({
      callSid: call.sid,
      ivrMenu: callData.ivrMenu,
      providerData: callData.providerData,
    });
    res.json({
      message: `Call initiated`,
      callSid: call.sid,
      updatedIvrMenu: callData.ivrMenu,
    });
  } catch (err: unknown) {
    console.error(colorErr(err));
    res.status(400).json({
      message: `${(err as Error)?.message || "failed to initiate call"}.`,
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
