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

app.use(async (req, _, next) => {
  await redisClient.set(STORE_KEYS.HOST, req.headers.host!);
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const wsProtocol = "wss";
  req.headers.protocol = protocol;
  req.headers.wsProtocol = wsProtocol;
  next();
});

app.get("/", (_, res) =>
  res.type("text").send("Hello World 👋, from Caller Assistant!!")
);

app.get("/data", (_, res) => {
  res.json({
    data: `internalId	applicationId	applicationSubmissionMethod	applicationSubmittedDate	groupName	groupNpi	groupTaxId	internalId	payerName	phoneNumber	providerAddress	providerName	providerNpi	providerSpecialty	providerType	serviceState	ticketType
    149483	Not Available		17/07/2023	VANCOUVER SLEEP CENTER, LLC	1285012963	473557616		Asuris Northwest Health	8883496558	12405 SE 2nd Cir  Vancouver WA 98684	CHARITY  KEMP	1487261798	Physician Assistant	Medical Providers	WA	Application Follow-up`,
  });
});

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
    const twiml = response.toString();
    const call = await twilioClient.calls.create({
      twiml,
      to: TWILIO_TO_NUMBER,
      from: TWILIO_FROM_NUMBER,
      statusCallback: `${protocol}://${req.headers.host}/callupdate`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      record: true,
    });
    await redisClient.set(STORE_KEYS.CALL_SID, call.sid);
    res.type("text").send(`Call initiated with SID: ${call.sid}`);
  } catch (err: $TSFixMe) {
    res
      .type("text")
      .status(400)
      .send(err?.message || "Failed to create call");
  }
});

app.post("/callupdate", async (req, res) => {
  console.info(
    "Call Status Update:",
    req.body.CallStatus,
    "for Call SID:",
    req.body.CallSid
  );
  await redisClient.set(STORE_KEYS.CALL_STATUS, req.body.CallStatus);
  return res.status(200).send();
});

app.post("/applicationupdate", async (req, res) => {
  const applicationStatus = req.body.applicationStatus;
  console.info({ applicationStatus });
  await redisClient.set(STORE_KEYS.APPLICATION_STATUS, applicationStatus);
  return res.status(200).send();
});

export default app;
