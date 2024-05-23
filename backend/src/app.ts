import { generateApplicationStatusJson } from "@scripts/applicationstatus";
import { getCallStatus } from "@scripts/call-status";
import { hangupCall } from "@scripts/hangup-call";
import { makeOutboundCall } from "@scripts/outbound-call";
import { triggerWebhook } from "@scripts/triggerwebhook";
import { ActiveCallConfig } from "@service/activecall-service";
import { CallLogKeys, CallLogService } from "@service/calllog-service";
import { CALL_TERMINATED_STATUS } from "@service/stream-service";
import { CallData, isValidCallData, updateIVRMenus } from "@utils/api";
import { isValidCallSid, scheduleCallStatusCheck } from "@utils/call";
import { colorErr } from "@utils/colorCli";
import cors from "cors";
import type { Express } from "express";
import express from "express";

const app: Express = express();

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("dist"));

app.use(async (req, _, next) => {
  // const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  // const wsProtocol = protocol === "https" ? "wss" : "ws";
  const protocol = "https";
  const wsProtocol = "wss";
  req.headers.protocol = protocol;
  req.headers.wsProtocol = wsProtocol;
  next();
});

app.get("/", (_, res) => {
  res.send("Hello World 👋, from Caller Assistant!!");
});

app.get("/calllog/:callsid", async (req, res) => {
  const sid = req.params.callsid;
  if (!sid || !isValidCallSid(sid)) {
    return res.status(400).json({ message: "call sid is missing or invalid." });
  }
  const callLog = await CallLogService.read(sid);
  if (!callLog) {
    return res
      .status(404)
      .json({ message: `Call Details not found for CallSid: ${sid}.` });
  }
  return res.json(callLog);
});

app.get("/applicationstatusjson/:callsid", async (req, res) => {
  const sid = req.params.callsid;
  if (!sid || !isValidCallSid(sid)) {
    return res.status(400).json({ message: "call sid is missing or invalid." });
  }
  const status = await getCallStatus(sid);
  if (status && !CALL_TERMINATED_STATUS.includes(status)) {
    return res.status(400).json({
      message: "Cannot get Application Status Json, call is not terminated.",
    });
  }
  let applicationStatus = (await CallLogService.get(
    sid,
    CallLogKeys.APPLICATION_STATUS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as Record<string, any>;
  if (Object.keys(applicationStatus).length) {
    return res.json(applicationStatus);
  }
  applicationStatus = await generateApplicationStatusJson(sid);
  if (!applicationStatus) {
    return res.status(400).json({ message: "Unable to find Transcription." });
  }
  CallLogService.create(sid, CallLogKeys.APPLICATION_STATUS, applicationStatus);
  return res.json(applicationStatus);
});

app.get("/triggerwebhook/:callsid", async (req, res) => {
  const sid = req.params.callsid;
  if (!sid || !isValidCallSid(sid)) {
    return res.status(400).json({ message: "call sid is missing or invalid." });
  }
  await triggerWebhook(sid);
  return res.json();
});

app.post("/makeoutboundcall", async (req, res) => {
  try {
    const sid = ActiveCallConfig.getInstance().getCallConfig()?.callSid;
    const status = sid ? await getCallStatus(sid) : null;
    if (sid && status && !CALL_TERMINATED_STATUS.includes(status)) {
      return res.status(400).json({
        message:
          "Cannot initiate another call when a previous call is in progress.",
      });
    }
    //TODO: find solution for for newlines and ' characters formatting
    let providerDataString = "",
      ivrMenuString = "";

    if (typeof req.body.providerData === "string") {
      providerDataString = (req.body.providerData as string)
        .replaceAll("\\n", "")
        .replaceAll("\\n'", "");
    }
    if (typeof req.body.ivrMenu === "string") {
      ivrMenuString = (req.body.ivrMenu as string)
        .replaceAll("\\n", "")
        .replaceAll("\\n'", "");
    }

    const plainProviderData = providerDataString
      ? JSON.parse(providerDataString)
      : req.body.providerData;
    const plainIvrMenu = ivrMenuString
      ? JSON.parse(ivrMenuString)
      : req.body.ivrMenu;

    const callData = {
      providerData: plainProviderData,
      ivrMenu: plainIvrMenu,
    } as CallData;
    const { isValid, message } = isValidCallData(callData);
    if (!isValid) {
      return res.status(400).json({ message, callSid: null });
    }

    const call = await makeOutboundCall({
      callTo: callData.providerData.phoneNumber,
      isHTTPS: req.headers.protocol === "https",
    });

    if (!call.sid) {
      return res
        .status(400)
        .json({ message: "Failed to initiate the call.", callSid: null });
    }
    scheduleCallStatusCheck(call.sid);

    const { transformedIvrMenu, updatedIvrMenu } = updateIVRMenus(callData);
    ActiveCallConfig.getInstance().setCallConfig({
      callSid: call.sid,
      ivrMenu: updatedIvrMenu,
      providerData: callData.providerData,
    });
    //TODO: refactor to one function call
    CallLogService.create(
      call.sid,
      CallLogKeys.PROVIDED_IVR_MENU,
      callData.ivrMenu
    );
    CallLogService.create(
      call.sid,
      CallLogKeys.TRANSFORMED_IVR_MENU,
      transformedIvrMenu
    );
    CallLogService.create(
      call.sid,
      CallLogKeys.INTERNAL_USED_IVR_MENU,
      updatedIvrMenu
    );
    res.json({
      message: `Call initiated`,
      callSid: call.sid,
      updatedIvrMenu: transformedIvrMenu,
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
  CallLogService.create(
    req.body.CallSid,
    CallLogKeys.CALL_STATUS,
    req.body.CallStatus
  );
  if (CALL_TERMINATED_STATUS.includes(req.body.CallStatus)) {
    triggerWebhook(req.body.CallSid);
  }
  return res.status(200).send();
});

app.post("/hangupcall", async (req, res) => {
  const callSid = req.body.callSid;
  try {
    await hangupCall(callSid);
    ActiveCallConfig.getInstance().deleteCallConfig();
    return res.status(200).send();
  } catch (err) {
    return res.status(400).send();
  }
});

export default app;
