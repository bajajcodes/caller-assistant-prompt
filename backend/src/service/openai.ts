import { getCallLLM } from "index";
import OpenAI from "openai";
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources/index.mjs";
import { AssistantResponse, MODELS } from "types/openai";
import { systemPromptCollection } from "utils/data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { $TSFixMe } from "../types/common";
import { OPEN_AI_KEY } from "../utils/config";
import { getConversationHistory, storeMessage } from "./redis";

let openaiClient: OpenAI;

const getSystemRoleMessage = (
  providerData: Record<string, string>
): ChatCompletionSystemMessageParam => {
  const providerDataStringified = JSON.stringify(providerData);
  const data = {
    label: "Data Presentation or Data",
    instruction: providerDataStringified.replaceAll("\t", " "),
  };
  const content = [...systemPromptCollection, data].reduce(
    (prompt, item) => `${prompt} ${item.label}:${item.instruction} `,
    ""
  );
  return { role: "system", content };
};

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
  userInput: string,
  callSid: string | undefined,
  onUpdate: (assistantPrompt: AssistantResponse, callSid: string) => void
): Promise<void> => {
  try {
    if (!callSid) throw Error(`CallSid: ${callSid} is Missing.`);
    const chatMessages = await getConversationHistory(callSid);
    if (!chatMessages || chatMessages.length < 1)
      throw Error(`Chat Messages for CallSid: ${callSid} are Missing.`);
    const userRoleMessage: ChatCompletionUserMessageParam = {
      role: "user",
      content: userInput,
    };
    chatMessages.push(userRoleMessage);
    let LLM_MODEL = getCallLLM(callSid);
    if (!LLM_MODEL) {
      LLM_MODEL = MODELS.GPT4_1106_PREVIEW;
      console.info(
        `Call Not Initialized with LLM Model, Switching To LLM Model: ${MODELS.GPT4_1106_PREVIEW} for ${callSid}`
      );
    }
    const completeion = await openaiClient.chat.completions.create({
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
    const assistantRoleMessage: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: assistantPrompt,
    };
    await storeMessage(callSid, userRoleMessage);
    await storeMessage(callSid, assistantRoleMessage);
    console.info(
      `CallSid: ${callSid} Chat Messages length is ${chatMessages.length + 1}`
    );
    onUpdate(assistantResponse, callSid);
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error({
      message: "Failed to get LLM or Assistant Response.",
      reason,
    });
    throw err;
  }
};

export { agent, connectOpenAI, getSystemRoleMessage };
