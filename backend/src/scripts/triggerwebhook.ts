import { CallLogKeys, CallLogService } from "@service/calllog-service";
import { CALL_TERMINATED_STATUS } from "@service/stream-service";
import { isValidCallSid } from "@utils/call";
import { colorErr, colorUpdate } from "@utils/colorCli";
import { WEBHOOK_URL } from "@utils/config";
import { generateApplicationStatusJson } from "./applicationstatus";
import { getCallStatus } from "./call-status";

export async function triggerWebhook(sid: string) {
  try {
    if (!sid || !isValidCallSid(sid)) {
      throw Error("Call Sid is not valid.");
    }
    if (!WEBHOOK_URL) {
      throw Error("Webhook URL does't exsist");
    }
    const status = await getCallStatus(sid);
    if (status && !CALL_TERMINATED_STATUS.includes(status)) {
      throw Error(
        `Call: ${sid}, with status: ${status} is not Terminated Yet.`
      );
    }
    const applicationStatus = await generateApplicationStatusJson(sid);
    if (!applicationStatus) {
      throw Error(`Unable to find Transcription for CallSid: ${sid}.`);
    }
    await CallLogService.create(
      sid,
      CallLogKeys.APPLICATION_STATUS,
      applicationStatus
    );
    const callLog = await CallLogService.read(sid);
    if (!callLog) {
      throw Error(`Call Details not found for CallSid: ${sid}.`);
    }
    const payload = { ...callLog, source: "CAP_AI" };
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(
        `Webhook failed with status ${response.status}: ${errorMessage} for CallSid: ${sid}.`
      );
    }
    //optional check
    // if (![200, 201].includes(response.status)) {
    //   throw new Error(
    //     `Webhook returned unexpected status code: ${response.status}`
    //   );
    // }
    console.log(
      colorUpdate(`Webhook triggered successfully for Callsid: ${sid}.`)
    );
    CallLogService.create(sid, CallLogKeys.WEBHOOK_TRIGGER_STATUS, "success");
  } catch (err) {
    console.error(colorErr(err));
    CallLogService.create(sid, CallLogKeys.WEBHOOK_TRIGGER_STATUS, "failed");
  }
}
