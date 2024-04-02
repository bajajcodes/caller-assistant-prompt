import { getCallService } from "index";
import OpenAI from "openai";
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources/index.mjs";
import { CALL_ENDED_BY_WHOM } from "types/call";
import { AssistantResponse, MODELS } from "types/openai";
import { systemPromptCollection } from "utils/data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { $TSFixMe } from "../types/common";
import { OPEN_AI_KEY } from "../utils/config";
import { hangupCall } from "./twilio";

let openaiClient: OpenAI;

const connectOpenAI = async () => {
  try {
    if (!OPEN_AI_KEY) {
      throw Error("openai: key is missing.");
    }
    openaiClient = new OpenAI({ apiKey: OPEN_AI_KEY });
    return openaiClient;
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    console.error(`openai: ${reason || "failed to connect with openAI"}.`);
    throw err;
  }
};

const agent = async (
  userInput: string,
  callSid: string | undefined,
  onUpdate: (assistantPrompt: AssistantResponse, callSid: string) => void
): Promise<void> => {
  try {
    const callService = getCallService();
    if (!callSid) throw Error(`openai: callsid ${callSid} is missing.`);
    const chatMessages = await callService.getConversationHistory(callSid);
    if (!chatMessages || chatMessages.length < 1)
      throw Error(`openai: chat messages for callsid: ${callSid} is missing.`);
    const userRoleMessage: ChatCompletionUserMessageParam = {
      role: "user",
      content: userInput,
    };
    chatMessages.push(userRoleMessage);
    let LLM_MODEL = await callService.getCallModel(callSid);
    if (!LLM_MODEL) {
      LLM_MODEL = MODELS.GPT4_1106_PREVIEW;
      console.info(
        `openai: call not initialized with llm model, switching to llm model: ${MODELS.GPT4_1106_PREVIEW} for ${callSid}.`
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

    if (!assistantPrompt) return;
    const assistantResponse = JSON.parse(assistantPrompt) as AssistantResponse;
    const assistantRoleMessage: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: assistantResponse.content,
    };

    await Promise.all([
      callService.storeMessage(callSid, userRoleMessage),
      callService.storeMessage(callSid, assistantRoleMessage),
    ]);
    onUpdate(assistantResponse, callSid);

    console.info({
      bot: assistantResponse.content,
      reponseType: assistantResponse.responseType,
    });
  } catch (err: $TSFixMe) {
    const reason = err?.message;
    const callEndReason = `openai: ${reason || "failed to get llm or assistant Response"}.`;
    console.error(callEndReason);
    await hangupCall({
      callSid,
      callEndedBy: CALL_ENDED_BY_WHOM.ERROR,
      callEndReason: callEndReason,
    });
  }
};

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

export { agent, connectOpenAI, getSystemRoleMessage };
