import { colorWarn } from "utils/colorCli";
import { IVRMenu } from "./ivr-service";

interface CallConfig {
  callSid: string;
  ivrMenu: Array<IVRMenu>;
  providerData: Record<string, string>;
  isIVRNavigationCompleted: boolean;
  isLastIvrMenuOptionUsed: boolean;
}

export class ActiveCallConfig {
  private static instance: ActiveCallConfig;
  private callConfig: CallConfig | null;

  private constructor() {
    this.callConfig = null;
  }

  public static getInstance(): ActiveCallConfig {
    if (!ActiveCallConfig.instance) {
      ActiveCallConfig.instance = new ActiveCallConfig();
    }
    return ActiveCallConfig.instance;
  }

  public setCallConfig({
    callSid,
    ivrMenu,
    providerData,
  }: {
    callSid: string;
    ivrMenu: Array<IVRMenu>;
    providerData: Record<string, string>;
  }): void {
    this.deleteCallConfig();
    this.callConfig = {
      callSid,
      ivrMenu,
      providerData,
      isIVRNavigationCompleted: false,
      isLastIvrMenuOptionUsed: false,
    };
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

  public getCallConfig() {
    return this.callConfig;
  }

  public deleteCallConfig(): void {
    this.callConfig = null;
  }

  public resetCallConfig(): void {
    if (this.callConfig) {
      console.log(
        `Resetting call configuration for call ${this.callConfig.callSid}`,
      );
      this.callConfig = {
        ...this.callConfig,
        isIVRNavigationCompleted: this.callConfig.isIVRNavigationCompleted,
      };
    }
  }
}
