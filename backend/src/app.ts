import cors from "cors";
import type { Express } from "express";
import express from "express";
import { getCallService } from "index";
import { storeHost } from "service/redis";
import { makeCallsInBatch } from "service/twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

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
  //TODO: remove not null assertion
  await storeHost(req.headers.host!);
  next();
});

app.get("/", (_, res) => res.send("Hello World 👋, from Caller Assistant!!"));

app.post("/batch", async (req, res) => {
  const payload = req.body;
  //empty array is valid payload
  if (!Array.isArray(payload))
    return res.status(400).json({ message: "Provider's data is not invalid" });
  makeCallsInBatch(payload);
  return res.json({ message: "Batch Created" });
});

app.post("/callupdate", async (req, res) => {
  console.info(
    "Call Status Update:",
    req.body.CallStatus,
    "for Call SID:",
    req.body.CallSid
  );
  const callSevice = getCallService();
  callSevice.updateCall(req.body.CallSid, { callStatus: req.body.CallStatus });
  return res.status(200).send();
});

export default app;
