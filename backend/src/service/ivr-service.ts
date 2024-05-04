import EventEmitter from "events";
import { BaseResponse, ResponseType } from "types/openai";
import { colorInfo, colorSuccess, colorWarn } from "utils/colorCli";
import { ActiveCallConfig } from "./activecall-service";
import { redisClient } from "./redis";

interface IVRMenu {
  intent: string;
  triggers: string[];
  response: string;
}

export class IVRService extends EventEmitter {
  private ivrMenu: Array<IVRMenu>;
  private callSid: string;
  private lastOptionIntent: string;

  constructor(ivrMenu: Array<IVRMenu>) {
    super();
    this.ivrMenu = ivrMenu;
    this.callSid = "";
    this.lastOptionIntent = ivrMenu.at(ivrMenu.length - 1)?.intent || "";
  }

  setCallSid(callSid: string) {
    this.callSid = callSid;
  }

  public handleResponse(transcript: string) {
    this.updateIVRTranscription({
      role: "user",
      content: transcript,
    });
    const transcriptFormatted = transcript
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/(\d)\s+(\d)/g, "$1$2");

    console.info(colorInfo(`ivrservice: ${transcriptFormatted}`));
    const match = this.ivrMenu.find((menu) =>
      menu.triggers.some((trigger) => transcriptFormatted.includes(trigger))
    );
    if (!match) {
      console.log(
        colorWarn(`ivrservice: No Match for: ${transcriptFormatted}`)
      );
      return;
    }
    console.log(
      colorSuccess(
        `ivrservice: Match, ${match.response} for: ${transcriptFormatted}`
      )
    );
    const ivrReply: BaseResponse = {
      content: match.response,
      responseType:
        match.response.at(match.response.length - 1) === "#" ||
        !Number.isNaN(+match.response)
          ? ResponseType.SEND_DIGITS
          : ResponseType.SAY_FOR_VOICE,
    };
    if (
      match.intent === this.lastOptionIntent &&
      !ActiveCallConfig.getInstance().getCallConfig()?.isLastIvrMenuOptionUsed
    ) {
      console.log(
        colorInfo(
          `ivrservice ->  lastOptionIntent: ${this.lastOptionIntent}, matchIntent: ${match.intent}`
        )
      );
      ActiveCallConfig.getInstance().setIsLastIVRMenuOptionUsed();
    }
    this.updateIVRTranscription({
      role: "assistant",
      content: match.response,
    });
    this.emit("ivrreply", ivrReply);
  }

  updateIVRTranscription(message: {
    content: string;
    role: "user" | "assistant";
  }) {
    const serializedMessage = JSON.stringify(message);
    redisClient.rPush(`${this.callSid}__ivr--transcription`, serializedMessage);
  }
}
