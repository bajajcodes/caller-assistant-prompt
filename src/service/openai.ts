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

const updateApplicationStatus = async (applicationStatus: string) => {
  await fetch("http://localhost:3000/applicationupdate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ applicationStatus }),
  });
};

const getDataOrDataPresentation = async () => {
  const response = await fetch("http://localhost:3000/data");
  const data = await response.json();
  console.info({ data });
  return data.data;
};

const availableTools: { [key: string]: (...args: $TSFixMe[]) => $TSFixMe } = {
  updateApplicationStatus,
  getDataOrDataPresentation,
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
    //TODO: test the function calls.
    const completeion = await openai.chat.completions.create({
      messages: chatMessages,
      model: MODELS.GPT4_1106_PREVIEW,
      response_format: {
        type: "json_object",
      },
      tools: [
        {
          type: "function",
          function: {
            name: "getDataOrDataPresentation",
            description:
              "Get the provider application data or data presentation.",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
        {
          type: "function",
          function: {
            name: "updateApplicationStatus",
            description: "Update the provider application status update.",
            parameters: {
              type: "object",
              properties: {
                applicationStatus: {
                  type: "string",
                },
              },
              required: ["applicationStatus"],
            },
          },
        },
      ],
    });

    const [choice] = completeion.choices;
    const { finish_reason, message } = choice;
    const { content } = message;
    const assistantPrompt = content;

    if (!assistantPrompt) return;

    if (finish_reason === "tool_calls" && message.tool_calls) {
      const functionName = message.tool_calls[0].function.name;
      const functionToCall = availableTools[functionName];
      const functionArgs = JSON.parse(message.tool_calls[0].function.arguments);
      const functionArgsArr = Object.values(functionArgs);
      // eslint-disable-next-line prefer-spread
      const functionResponse = await functionToCall.apply(
        null,
        functionArgsArr
      );
      chatMessages.push({
        role: "function",
        name: functionName,
        content: ` The result of the last function was this: ${JSON.stringify(functionResponse)}`,
      });
      console.info({ functionResponse });
      return;
    }
    chatMessages.push({ role: "assistant", content: assistantPrompt });

    const assistantResponse = JSON.parse(assistantPrompt) as AssistantResponse;
    onUpdate(assistantResponse);
  } catch (err: $TSFixMe) {
    const message = err?.message || "Failed to get LLM or Assistant Response.";
    throw Error(message);
  }
};

export { agent, connectOpenAI, intializeChatMessages };
