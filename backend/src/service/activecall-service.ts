import { MODELS } from "types/openai";
import { colorWarn } from "utils/colorCli";

interface CallConfig {
  callSid: string;
  callModel: MODELS;
  callEndpointing: number;
  isIVRNavigationCompleted: boolean;
  isLastIvrMenuOptionUsed: boolean;
}

export class ActiveCallConfig {
  private static instance: ActiveCallConfig;
  private callConfig: CallConfig | null;
  private timer: NodeJS.Timeout | null;

  private constructor() {
    this.callConfig = null;
    this.timer = null;
  }

  public static getInstance(): ActiveCallConfig {
    if (!ActiveCallConfig.instance) {
      ActiveCallConfig.instance = new ActiveCallConfig();
    }
    return ActiveCallConfig.instance;
  }

  public setCallConfig(
    callSid: string,
    callModel: MODELS,
    callEndpointing: number
  ): void {
    this.callConfig = {
      callSid,
      callModel,
      callEndpointing,
      isIVRNavigationCompleted: false,
      isLastIvrMenuOptionUsed: false,
    };

    // Clear any existing timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // Set a new timer to reset the call configuration after 1 minute and 30 seconds
    // this.timer = setTimeout(() => {
    //   this.resetCallConfig();
    // }, 90000); // 1 minute and 30 seconds = 90000 milliseconds
  }

  public setIVRNavigationCompleted() {
    if (!this.callConfig) return;
    console.log(colorWarn(`IVR Navigation Completed`));
    this.callConfig.isIVRNavigationCompleted = true;
  }

  public setIsLastIVRMenuOptionUsed() {
    if (!this.callConfig) return;
    this.callConfig.isLastIvrMenuOptionUsed = true;
  }

  public setEndpointing(endpointing: number) {
    if (!this.callConfig) return;
    this.callConfig.callEndpointing = endpointing;
  }

  public getCallConfig() {
    return this.callConfig;
  }

  public deleteCallConfig(): void {
    this.callConfig = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private resetCallConfig(): void {
    if (this.callConfig) {
      console.log(
        `Resetting call configuration for call ${this.callConfig.callSid}`
      );
      this.callConfig = {
        ...this.callConfig,
        callModel: MODELS.GPT_4_TUBRO,
        callEndpointing: 100,
        isIVRNavigationCompleted: this.callConfig.isIVRNavigationCompleted,
      };
    }
  }
}
