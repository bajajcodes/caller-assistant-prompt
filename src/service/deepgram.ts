import { createClient } from "@deepgram/sdk";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { DEEPGRAM_API_KEY } from "../utils/config";

export const connectDeepgram = () => {
  try {
    if (!DEEPGRAM_API_KEY) {
      throw Error("Deepgram API Key is Missing");
    }
    const deepgram = createClient(DEEPGRAM_API_KEY);
    return deepgram.listen.live({
      model: "enhanced-phonecall",
      smart_format: true,
      encoding: "mulaw",
      sample_rate: 8000,
      channels: 1,
    });
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Connect with Deepgram";
    throw Error(message);
  }
};
