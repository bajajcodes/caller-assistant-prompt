import {
  LiveClient,
  LiveSchema,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  createClient,
} from "@deepgram/sdk";
import EventEmitter from "events";
import { $TSFixMe } from "types/common";
import {
  colorErr,
  colorInfo,
  colorSuccess,
  colorUpdate,
  colorWarn,
} from "utils/colorCli";
import { DEEPGRAM_API_KEY } from "utils/config";
import { ActiveCallConfig } from "./activecall-service";

// const PUNCTUATION_TERMINATORS = [".", "!", "?"];
const MAX_RETRY_ATTEMPTS = 3;

export class TranscriptionService extends EventEmitter {
  private deepgramLive: LiveClient;
  private audioBuffer: Buffer[];
  private retryAttempts: number;
  private finalResult: string;
  private speechFinal: boolean;

  constructor() {
    super();
    const deepgram = createClient(DEEPGRAM_API_KEY || "");
    const transcriptionOptions: LiveSchema = {
      model: "nova-2-phonecall",
      smart_format: true,
      encoding: "mulaw",
      sample_rate: 8000,
      channels: 1,
      interim_results: true,
      endpointing: ActiveCallConfig.getInstance().getCallConfig()
        ?.isIVRNavigationCompleted
        ? 400
        : 200,
      utterance_end_ms: ActiveCallConfig.getInstance().getCallConfig()
        ?.isIVRNavigationCompleted
        ? 1500
        : 1000,
    };
    console.log(
      colorUpdate(
        `endpointing:${transcriptionOptions.endpointing} 
        utterance_end_ms:${transcriptionOptions.utterance_end_ms}`
      )
    );
    this.deepgramLive = deepgram.listen.live(transcriptionOptions);
    this.finalResult = "";
    this.audioBuffer = [];
    this.retryAttempts = 0;
    this.speechFinal = false;

    this.deepgramLive.addListener(LiveTranscriptionEvents.Open, () => {
      this.deepgramLive.on(LiveTranscriptionEvents.Close, () => {
        console.log(colorWarn("deepgram: connection closed"));
        console.log(
          colorErr(
            `deepgram: number of lost audio packets: ${this.audioBuffer.length + 1}`
          )
        );
        this.emitTranscription();
        this.audioBuffer = [];
      });

      this.deepgramLive.on(
        LiveTranscriptionEvents.Transcript,
        (transcription: LiveTranscriptionEvent) => {
          console.log(colorInfo("deepgram: transcript recieved"));
          const alternatives = transcription.channel?.alternatives;
          let text = "";
          if (alternatives) {
            text = alternatives[0]?.transcript
              .trim()
              // replace space in between the numbers
              .replace(/(?<=\d) +(?=\d)/g, "");
          }
          console.log(colorSuccess(`deepgram[transcript]: ${text}`));
          if (transcription.is_final && text.trim().length) {
            this.finalResult += ` ${text}`;
            if (transcription.speech_final) {
              this.speechFinal = true;
              this.emit("transcription", this.finalResult);
              this.finalResult = "";
            } else {
              this.speechFinal = false;
            }
          } else {
            console.log(colorWarn("utterance", text));
            this.emit("utterance", text);
          }
        }
      );

      this.deepgramLive.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        if (!this.speechFinal) {
          console.log(
            colorWarn(
              `UtteranceEnd received before speechFinal, the text collected so far: ${this.finalResult}`
            )
          );
          if (
            ActiveCallConfig.getInstance().getCallConfig()
              ?.isIVRNavigationCompleted
          ) {
            this.speechFinal = true;
            this.emit("transcription", this.finalResult);
            this.finalResult = "";
          }
        } else {
          console.log(
            colorInfo(
              "STT -> Speech was already final when UtteranceEnd recevied"
            )
          );
        }
      });

      this.deepgramLive.on(LiveTranscriptionEvents.Error, (err: unknown) => {
        console.log(colorErr("deepgram: error recieved"));
        console.error(colorErr(err));
        this.emit("transcriptionerror", err);
      });
    });
  }

  send(payload: $TSFixMe) {
    const audioBuffer = Buffer.from(payload, "base64");
    this.audioBuffer.push(audioBuffer);
    if (this.deepgramLive.getReadyState() === 1) {
      const bufferedData = Buffer.concat(this.audioBuffer);
      if (bufferedData.length > 0) {
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
      console.error(colorInfo("deepgram: error sending buffered data"));
      console.error(colorErr(error));
      this.retryAttempts++;

      if (this.retryAttempts <= MAX_RETRY_ATTEMPTS) {
        console.log(
          colorWarn(`deepgram: retrying send (attempt ${this.retryAttempts})`)
        );
        setTimeout(() => {
          this.sendBufferedData(bufferedData);
        }, 1000); // Retry after 1 second
      } else {
        console.error(
          colorErr(
            "deepgram: max retry attempts reached, discarding buffered data"
          )
        );
        console.log(
          colorErr(
            `deepgram: number of lost audio packets: ${this.audioBuffer.length + 1}`
          )
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
