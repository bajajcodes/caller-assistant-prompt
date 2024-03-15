import { DeepgramClient, createClient } from "@deepgram/sdk";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "types/common";
import { DEEPGRAM_API_KEY } from "../utils/config";

let deepgramClient: DeepgramClient;

const connectDeepgram = () => {
  try {
    if (!DEEPGRAM_API_KEY) {
      throw Error("Deepgram API Key is Missing");
    }
    deepgramClient = createClient(DEEPGRAM_API_KEY);
    console.info("Connected to Deepgram Client");
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({ message: "Failed to Connect with Deepgram", reason });
    throw err;
  }
};

export { connectDeepgram, deepgramClient };
