import { CallLogKeys, CallLogService } from "@service/calllog-service";
import twillio from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "utils/config";

export const getCallStatus = async (callSid: string) => {
  try {
    if (!callSid) return null;
    const client = new twillio.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const update = await client.calls(callSid).fetch();
    CallLogService.create(callSid, CallLogKeys.CALL_STATUS, update.status);
    console.log(`callstatus: ${update.status} for callsid: ${callSid}`);
    return update.status;
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`twilio: ${reason || "failed to get status."}`);
    return null;
  }
};
