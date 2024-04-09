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
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY_IN_SECS = 5;
const DEBOUNCE_DELAY = DEBOUNCE_DELAY_IN_SECS * 1000;

export class TranscriptionService extends EventEmitter {
  private deepgramLive: LiveClient;
  private finalResult: string;
  private audioBuffer: Buffer[];
  private retryAttempts: number;
  private lastTranscriptionTime: number;

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
    this.audioBuffer = [];
    this.retryAttempts = 0;
    this.lastTranscriptionTime = Date.now();

    this.deepgramLive.addListener(LiveTranscriptionEvents.Open, () => {
      this.deepgramLive.on(LiveTranscriptionEvents.Close, () => {
        console.log("deepgram: connection closed");
        console.log(
          `deepgram: number of lost audio packets: ${this.audioBuffer.length + 1}`
        );
        this.emitTranscription();
        this.audioBuffer = [];
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
            const currentTime = Date.now();

            if (
              (PUNCTUATION_TERMINATORS.includes(text.slice(-1)) ||
                PUNCTUATION_TERMINATORS.includes(this.finalResult.slice(-1))) &&
              transcription.speech_final
            ) {
              this.finalResult += `${text}`;
              this.emitTranscription();
            } else {
              this.finalResult += `${text}`;
              if (currentTime - this.lastTranscriptionTime >= DEBOUNCE_DELAY) {
                console.log(
                  `deepgram: emiting transcription because of ${DEBOUNCE_DELAY_IN_SECS} seconds inactivity.`
                );
                this.emitTranscription();
              }
            }
            this.lastTranscriptionTime = currentTime;
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
    const audioBuffer = Buffer.from(payload, "base64");
    this.audioBuffer.push(audioBuffer);
    if (this.deepgramLive.getReadyState() === 1) {
      const bufferedData = Buffer.concat(this.audioBuffer);
      if (bufferedData.length > 0) {
        // this.deepgramLive.send(bufferedData);
        // this.audioBuffer = [];
        this.sendBufferedData(bufferedData);
      }
    }
  }

  private sendBufferedData(bufferedData: Buffer) {
    try {
      this.deepgramLive.send(bufferedData);
      this.audioBuffer = [];
      this.retryAttempts = 0;
    } catch (error) {
      console.error("deepgram: error sending buffered data");
      console.error(error);
      this.retryAttempts++;

      if (this.retryAttempts <= MAX_RETRY_ATTEMPTS) {
        console.log(`deepgram: retrying send (attempt ${this.retryAttempts})`);
        setTimeout(() => {
          this.sendBufferedData(bufferedData);
        }, 1000); // Retry after 1 second
      } else {
        console.error(
          "deepgram: max retry attempts reached, discarding buffered data"
        );
        console.log(
          `deepgram: number of lost audio packets: ${this.audioBuffer.length + 1}`
        );
        this.audioBuffer = [];
        this.retryAttempts = 0;
      }
    }
  }

  private emitTranscription() {
    if (this.finalResult && this.finalResult.trim().length) {
      this.emit("transcription", this.finalResult);
      this.finalResult = "";
    }
  }
}
