import { DeepgramClient, createClient } from "@deepgram/sdk";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { DEEPGRAM_API_KEY } from "../utils/config";

let deepgramClient: DeepgramClient;

const connectDeepgram = () => {
  try {
    if (!DEEPGRAM_API_KEY) {
      throw Error("deepgram: api key is missing.");
    }
    deepgramClient = createClient(DEEPGRAM_API_KEY);
    console.info("deepgram: connected to deepgram client.");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`deepgram: ${reason || "Failed to Connect with Deepgram"}`);
    throw err;
  }
};

export { connectDeepgram, deepgramClient };
