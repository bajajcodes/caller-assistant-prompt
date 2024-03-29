export enum MODELS {
  GPT4 = "gpt-4",
  GPT4_1106_PREVIEW = "gpt-4-1106-preview",
  GPT_3_5_TUBRO = "gpt-3.5-turbo",
}

//info: temporarily stored here
export enum ENDPOINTING {
  INITAL = 10,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  AFTER_TIMEOUT = 10,
}

export enum ResponseType {
  SAY_FOR_VOICE = "sayForVoice",
  SEND_DIGITS = "sendDigits",
  END_CALL = "endCall",
}

interface BaseResponse {
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
