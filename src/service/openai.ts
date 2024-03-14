import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { MODELS, ResponseType } from "types/openai";
//TODO: fix no-unused-vars for $TSFixMe type
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { $TSFixMe } from "../types/common";
import { OPEN_AI_KEY } from "../utils/config";
import { systemPrompt } from "../utils/data";

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

let chatMessages: Array<ChatCompletionMessageParam> = [];

const intializeChatMessages = () => {
  chatMessages = [];
  chatMessages.push({ role: "system", content: systemPrompt });
};

const connectOpenAI = async () => {
  try {
    if (!OPEN_AI_KEY) {
      throw Error("Open AI Key is Missing");
    }
    intializeChatMessages();
    return new OpenAI({ apiKey: OPEN_AI_KEY });
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Connect with OpenAI";
    throw Error(message);
  }
};

const agent = async (
  openai: OpenAI,
  userInput: string,
  onUpdate: (assistantPrompt: AssistantResponse) => void
): Promise<void> => {
  try {
    chatMessages.push({ role: "user", content: userInput });
    //TODO: use stream for quick responses
    const completeion = await openai.chat.completions.create({
      messages: chatMessages,
      model: MODELS.GPT4_1106_PREVIEW,
      response_format: {
        type: "json_object",
      },
    });

    const [choice] = completeion.choices;
    const { content } = choice.message;
    const assistantPrompt = content;

    if (!assistantPrompt) return;

    chatMessages.push({ role: "assistant", content: assistantPrompt });

    const assistantResponse = JSON.parse(assistantPrompt) as AssistantResponse;
    onUpdate(assistantResponse);
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to get LLM or Assistant Response.";
    throw Error(message);
  }
};

export { agent, connectOpenAI, intializeChatMessages };
