import twillio from "twilio";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "utils/config";

export const hangupCall = async (callSid: string) => {
  try {
    if (!callSid) {
      console.info(
        `twilio: cannot hangup call, because callsid: ${callSid} does not exists.`
      );
      return false;
    }
    const client = new twillio.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.calls(callSid).update({ status: "completed" });
    console.info("twilio: hangup call done.");
    return true;
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`twilio: ${reason || "failed to hangup call."}`);
    return false;
  }
};
