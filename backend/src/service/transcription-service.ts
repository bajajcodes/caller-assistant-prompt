import {
  LiveClient,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  createClient,
} from "@deepgram/sdk";
import EventEmitter from "events";
import { $TSFixMe } from "types/common";
import { DEEPGRAM_API_KEY } from "utils/config";
import { ActiveCallConfig } from "./activecall-service";

const PUNCTUATION_TERMINATORS = [".", "!", "?"];

export class TranscriptionService extends EventEmitter {
  private deepgramLive: LiveClient;
  private finalResult: string;

  constructor() {
    super();
    //TODO: remove null type assertion
    const deepgram = createClient(DEEPGRAM_API_KEY!);
    const endpointing =
      ActiveCallConfig.getInstance().getCallConfig()?.callEndpointing || 200;
    console.log(`deepgram: endpointing ${endpointing}ms`);
    this.deepgramLive = deepgram.listen.live({
      model: "enhanced-phonecall",
      smart_format: true,
      encoding: "mulaw",
      sample_rate: 8000,
      channels: 1,
      punctuate: true,
      endpointing,
    });

    this.finalResult = "";

    this.deepgramLive.addListener(LiveTranscriptionEvents.Open, () => {
      this.deepgramLive.on(LiveTranscriptionEvents.Close, () => {
        console.log("deepgram: connection closed");
        if (this.finalResult && this.finalResult.trim().length) {
          this.emit("transcription", this.finalResult);
          this.finalResult = "";
        }
      });

      this.deepgramLive.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log("deepgram: metadata recieved");
        console.log(data);
      });

      this.deepgramLive.on(
        LiveTranscriptionEvents.Transcript,
        (transcription: LiveTranscriptionEvent) => {
          console.log("deepgram: transcript recieved");
          const alternatives = transcription.channel?.alternatives;
          let text = "";
          if (alternatives) {
            text = alternatives[0]?.transcript.trim();
          }

          if (text) {
            console.log(`deepgram: transcript ${text}`);

            if (
              PUNCTUATION_TERMINATORS.includes(text.slice(-1)) &&
              (transcription.speech_final ||
                PUNCTUATION_TERMINATORS.includes(this.finalResult.slice(-1)))
            ) {
              this.finalResult += `${text}`;
              this.emit("transcription", this.finalResult);
              this.finalResult = "";
            } else {
              this.finalResult += `${text}`;
            }
          }
        }
      );

      this.deepgramLive.on(LiveTranscriptionEvents.Error, (err) => {
        console.log("deepgram: error recieved");
        console.error(err);
        this.emit("transcriptionerror", err);
      });
    });
  }

  send(payload: $TSFixMe) {
    // TODO: Buffer up the media and then send
    if (this.deepgramLive.getReadyState() === 1) {
      const audioBuffer = Buffer.from(payload, "base64");
      if (audioBuffer.length > 0) this.deepgramLive.send(audioBuffer);
      else console.log(`deepgram: dropped empty audio buffer`);
    }
  }
}
