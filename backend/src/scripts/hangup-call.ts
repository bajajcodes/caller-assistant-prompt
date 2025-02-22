import { CallLogKeys, CallLogService } from "@service/calllog-service";
import twillio from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "utils/config";

export const hangupCall = async (callSid: string) => {
  try {
    const client = new twillio.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const update = await client.calls(callSid).update({ status: "completed" });
    CallLogService.create(callSid, CallLogKeys.CALL_STATUS, update.status);
    CallLogService.create(callSid, CallLogKeys.CALL_ENDED_BY, "/hangupcall");
    console.info("twilio: hangup call done.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`twilio: ${reason || "failed to hangup call."}`);
  }
};
