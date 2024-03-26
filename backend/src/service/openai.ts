import { getActiveCallChatMessages } from "index";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { AssistantResponse, MODELS } from "types/openai";
import { systemPromptCollection } from "utils/data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { $TSFixMe } from "../types/common";
import { LLM_MODEL_SWITCH_DURATION, OPEN_AI_KEY } from "../utils/config";

const timeout = LLM_MODEL_SWITCH_DURATION
  ? parseInt(LLM_MODEL_SWITCH_DURATION, 10)
  : 90000;
let timeoutId: NodeJS.Timeout;
//TODO: use model switcher
let LLM_MODEL = MODELS.GPT4_1106_PREVIEW;
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

const intializeChatMessagesForACall = (
  providerData: Record<string, string>
) => {
  const providerDataStringified = JSON.stringify(providerData);
  const chatMessages: Array<ChatCompletionMessageParam> = [];
  const data = {
    label: "Data Presentation or Data",
    instruction: providerDataStringified.replaceAll("\t", " "),
  };
  const content = [...systemPromptCollection, data].reduce(
    (prompt, item) => `${prompt} ${item.label}:${item.instruction} `,
    ""
  );
  chatMessages.push({ role: "system", content });
  return chatMessages;
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
    const chatMessages = getActiveCallChatMessages(callSid);
    if (!chatMessages)
      throw Error(`Chat Messages for CallSid: ${callSid} are Missing.`);
    chatMessages.push({ role: "user", content: userInput });
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
    chatMessages.push({ role: "assistant", content: assistantPrompt });
    console.info(
      `CallSid: ${callSid} Chat Messages length is ${chatMessages.length}`
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

export { agent, connectOpenAI, intializeChatMessagesForACall };
