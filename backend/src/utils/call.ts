import { hangupCall } from "@scripts/hangup-call";
import { CallLogKeys, CallLogService } from "@service/calllog-service";
import { CALL_TERMINATED_STATUS } from "@service/stream-service";
import { CALL_QUEUE_DELAY } from "./config";

const DELAY = CALL_QUEUE_DELAY ? +CALL_QUEUE_DELAY : 960000;

function isValidCallSid(str: string): boolean {
  // Regex for Call SID format: "CA" followed by 32 alphanumeric characters
  const callSidRegex = /^CA[a-zA-Z0-9]{32}$/;

  // Basic regex check
  if (!callSidRegex.test(str)) {
    return false;
  }

  return true;
}

async function checkAndUpdateCallStatus(callSid: string) {
  try {
    const status = (await CallLogService.get(
      callSid,
      CallLogKeys.CALL_STATUS
    )) as string;
    if (CALL_TERMINATED_STATUS.includes(status)) {
      console.log(
        `checkAndUpdateCallStatus: Call SID ${callSid} is already completed.`
      );
      return;
    }
    await hangupCall(callSid);
    console.log(
      `checkAndUpdateCallStatus: Updated call status for SID: ${callSid}`
    );
  } catch (err) {
    console.error(
      `checkAndUpdateCallStatus: Error checking/updating call status for SID ${callSid}:`,
      err
    );
  }
}

function scheduleCallStatusCheck(callSid: string) {
  console.log(`Scheduling status check for Call SID: ${callSid} in 16 minutes`);
  setTimeout(() => {
    checkAndUpdateCallStatus(callSid);
  }, DELAY);
}

export { isValidCallSid, scheduleCallStatusCheck };
