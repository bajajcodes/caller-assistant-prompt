import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { AssistantResponse, MODELS } from "types/openai";
import { applicationStatusPrompt, systemPromptCollection } from "utils/data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { $TSFixMe } from "../types/common";
import { LLM_MODEL_SWITCH_DURATION, OPEN_AI_KEY } from "../utils/config";

let chatMessages: Array<ChatCompletionMessageParam> = [];
let chatTranscription: Array<ChatCompletionMessageParam> = [];
const timeout = LLM_MODEL_SWITCH_DURATION
  ? parseInt(LLM_MODEL_SWITCH_DURATION, 10)
  : 90000;
let timeoutId: NodeJS.Timeout;
let LLM_MODEL = MODELS.GPT_3_5_TUBRO;
let openaiClient: OpenAI;

export const resetLLMModelTimer = () => {
  if (timeoutId) {
    console.info(
      `Resetting 1 minute 30 seconds of timer. Switching from: ${LLM_MODEL} to: ${MODELS.GPT_3_5_TUBRO}.`
    );
    LLM_MODEL = MODELS.GPT_3_5_TUBRO;
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    //INFO: closure get's applied here
    console.info(
      `1 minute 30 seconds of timer done. Switching from: ${LLM_MODEL} to: ${MODELS.GPT4_1106_PREVIEW}.`
    );
    LLM_MODEL = MODELS.GPT4_1106_PREVIEW;
  }, timeout);
  console.info("Switch LLM Model Timer Started.");
};

const intializeChatMessages = (providerData: string) => {
  const data = {
    label: "Data Presentation or Data",
    instruction: providerData.replaceAll("\t", " "),
  };
  const content = [...systemPromptCollection, data].reduce(
    (prompt, item) => `${prompt} ${item.label}:${item.instruction} `,
    ""
  );
  chatMessages = [];
  chatTranscription = [];
  chatMessages.push({ role: "system", content });
};

const getChatMessages = () => chatMessages;
const getChatTranscription = () => chatTranscription;

const connectOpenAI = async () => {
  try {
    if (!OPEN_AI_KEY) {
      throw Error("Open AI Key is Missing");
    }
    openaiClient = new OpenAI({ apiKey: OPEN_AI_KEY });
    return openaiClient;
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({ message: "Failed to Connect with OpenAI", reason });
    throw err;
  }
};

const agent = async (
  openai: OpenAI,
  userInput: string,
  onUpdate: (assistantPrompt: AssistantResponse) => void
): Promise<void> => {
  try {
    chatMessages.push({ role: "user", content: userInput });
    chatTranscription.push({
      role: "user",
      content: userInput,
    });
    //TODO: test the function calls.
    const completeion = await openai.chat.completions.create({
      messages: chatMessages,
      model: LLM_MODEL,
      response_format: {
        type: "json_object",
      },
    });

    const [choice] = completeion.choices;
    const { message } = choice;
    const { content } = message;
    const assistantPrompt = content;
    console.info({ assistantPrompt, model: completeion.model });

    if (!assistantPrompt) return;
    const assistantResponse = JSON.parse(assistantPrompt) as AssistantResponse;
    chatMessages.push({ role: "assistant", content: assistantPrompt });
    chatTranscription.push({
      role: "assistant",
      content: assistantResponse.content,
    });
    onUpdate(assistantResponse);
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({
      message: "Failed to get LLM or Assistant Response.",
      reason,
    });
    throw err;
  }
};

const applicationStatusAgent = async () => {
  try {
    const messages: Array<ChatCompletionMessageParam> = [
      {
        role: "system",
        content: applicationStatusPrompt,
      },
      {
        role: "user",
        content: `${JSON.stringify(chatTranscription)}`,
      },
    ];
    const completeion = await openaiClient.chat.completions.create({
      messages,
      model: MODELS.GPT4_1106_PREVIEW,
    });
    const [choice] = completeion.choices;
    const { message } = choice;
    const { content } = message;
    return content;
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({
      message: "Failed to get application status.",
      reason,
    });
    throw err;
  }
};

export {
  agent,
  applicationStatusAgent,
  connectOpenAI,
  getChatMessages,
  getChatTranscription,
  intializeChatMessages,
};
