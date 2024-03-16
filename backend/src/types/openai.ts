export enum MODELS {
  GPT4 = "gpt-4",
  GPT4_1106_PREVIEW = "gpt-4-1106-preview",
}

export enum ResponseType {
  SAY_FOR_VOICE = "sayForVoice",
  SEND_DIGITS = "sendDigits",
  END_CALL = "endCall",
}

export enum InputSource {
  HUMAN = "Human",
  IVR = "IVR",
}

interface BaseResponse {
  inputSource: InputSource;
  responseType: ResponseType;
  content: string;
}

interface SayForVoiceResponse extends BaseResponse {
  responseType: ResponseType.SAY_FOR_VOICE;
}

interface SendDigitsResponse extends BaseResponse {
  responseType: ResponseType.SEND_DIGITS;
}

export interface EndCallResponse extends BaseResponse {
  responseType: ResponseType.END_CALL;
  applicationStatus: string; // Only in this type
}

export type AssistantResponse =
  | SayForVoiceResponse
  | SendDigitsResponse
  | EndCallResponse;
