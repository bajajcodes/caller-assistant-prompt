import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { AssistantResponse, MODELS } from "types/openai";
//TODO: fix no-unused-vars for $TSFixMe type
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { systemPromptCollection } from "utils/data";
import type { $TSFixMe } from "../types/common";
import { OPEN_AI_KEY } from "../utils/config";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const tools = [
  {
    type: "function",
    function: {
      name: "getDataOrDataPresentation",
      description: "Get the provider application data or data presentation.",
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
];

let chatMessages: Array<ChatCompletionMessageParam> = [];

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const availableTools: { [key: string]: (...args: $TSFixMe[]) => $TSFixMe } = {
  updateApplicationStatus,
  getDataOrDataPresentation,
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
  chatMessages.push({ role: "system", content });
};

const getChatMessages = () => chatMessages;

const connectOpenAI = async () => {
  try {
    if (!OPEN_AI_KEY) {
      throw Error("Open AI Key is Missing");
    }
    return new OpenAI({ apiKey: OPEN_AI_KEY });
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
    //TODO: test the function calls.
    const completeion = await openai.chat.completions.create({
      messages: chatMessages,
      model: MODELS.GPT4_1106_PREVIEW,
      response_format: {
        type: "json_object",
      },
    });

    const [choice] = completeion.choices;
    const { message } = choice;
    const { content } = message;
    const assistantPrompt = content;
    console.info({ assistantPrompt });

    if (!assistantPrompt) return;

    // if (finish_reason === "tool_calls" && message.tool_calls) {
    //   const functionName = message.tool_calls[0].function.name;
    //   const functionToCall = availableTools[functionName];
    //   const functionArgs = JSON.parse(message.tool_calls[0].function.arguments);
    //   const functionArgsArr = Object.values(functionArgs);
    //   console.info({
    //     functionName,
    //     functionToCall,
    //     functionArgs,
    //     functionArgsArr,
    //   });
    //   // eslint-disable-next-line prefer-spread
    //   const functionResponse = await functionToCall.apply(
    //     null,
    //     functionArgsArr
    //   );
    //   console.info({ functionResponse });
    //   chatMessages.push({
    //     role: "function",
    //     name: functionName,
    //     content: ` The result of the last function was this: ${JSON.stringify(functionResponse)}`,
    //   });
    //   console.info({ functionResponse });
    //   return;
    // }
    chatMessages.push({ role: "assistant", content: assistantPrompt });
    const assistantResponse = JSON.parse(assistantPrompt) as AssistantResponse;
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

export { agent, connectOpenAI, getChatMessages, intializeChatMessages };
