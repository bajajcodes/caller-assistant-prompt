import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { MODELS, ResponseType } from "types/openai";
//TODO: fix no-unused-vars for $TSFixMe type
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $TSFixMe } from "../types/common";
import { OPEN_AI_KEY } from "../utils/config";
import { systemPrompt } from "../utils/data";

export interface AgentResponse {
  responseType: ResponseType;
  content: string;
}

const messages: Array<ChatCompletionMessageParam> = [
  { role: "system", content: systemPrompt },
];

const FALLBACK_RESPONSE: AgentResponse = {
  responseType: ResponseType.SAY_FOR_VOICE,
  content: "",
};

export const connectOpenAI = async () => {
  try {
    if (!OPEN_AI_KEY) {
      throw Error("Open AI Key is Missing");
    }
    return new OpenAI({ apiKey: OPEN_AI_KEY });
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to Connect with OpenAI";
    throw Error(message);
  }
};

export const agent = async (
  openai: OpenAI,
  userInput: string,
): Promise<AgentResponse> => {
  messages.push({ role: "user", content: `${userInput}` });
  const response = await openai.chat.completions.create({
    messages,
    model: MODELS.GPT4_1106_PREVIEW,
    response_format: {
      type: "json_object",
    },
  });
  const assistantPrompt = response.choices[0].message?.content;
  messages.push({ role: "assistant", content: assistantPrompt });
  const GPT_RESPONSE = JSON.parse(
    assistantPrompt || `${FALLBACK_RESPONSE}`,
  ) as AgentResponse;
  return GPT_RESPONSE;
};
