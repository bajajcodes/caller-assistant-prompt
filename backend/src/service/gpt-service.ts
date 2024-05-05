import EventEmitter from "events";
import OpenAI from "openai";
import { ChatCompletionSystemMessageParam } from "openai/resources/index.mjs";
import { AssistantResponse, MODELS, ResponseType } from "types/openai";
import { colorInfo, colorWarn } from "utils/colorCli";
import { OPEN_AI_KEY } from "utils/config";
import { systemPromptCollection } from "utils/data";
import { ActiveCallConfig } from "./activecall-service";
import { redisClient } from "./redis";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

const getSystemRoleMessage = (
  providerData: Record<string, unknown>
): ChatCompletionSystemMessageParam => {
  const providerDataStringified = JSON.stringify(providerData);
  const data = {
    label: "Data Presentation or Data",
    instruction: providerDataStringified.replaceAll("\t", " "),
  };
  const promptCollection = systemPromptCollection;
  const prompt = [...promptCollection, data];
  const content = prompt.reduce(
    (prompt, item) => `${prompt} ${item.label}:${item.instruction} `,
    ""
  );
  return { role: "system", content };
};

export class GPTService extends EventEmitter {
  private openaiClient: OpenAI;
  private callSid: string;
  private context: Array<Message>;
  private partialResponseIndex = 0;

  constructor() {
    super();
    this.openaiClient = new OpenAI({ apiKey: OPEN_AI_KEY });
    this.callSid = "";
    this.context = [];
  }

  async setCallSid(callSid: string) {
    this.callSid = callSid;
    this.context = await this.getCallTranscription();
  }

  async completion(text: string, interactionCount: number) {
    try {
      let completeResponse = "";
      let partialResponse = "";

      this.updateUserContext({ role: "user", content: text });

      const completeion = await this.openaiClient.chat.completions.create({
        messages: this.context,
        model: MODELS.GPT_4_TUBRO,
        temperature: 0,
        max_tokens: 100,
        stream: true,
      });

      for await (const chunk of completeion) {
        const content = chunk.choices[0].delta.content;
        const finishReason = chunk.choices[0].finish_reason;

        if (content) {
          console.log(colorInfo(`gpt: ${content}`));
          completeResponse += content;
          partialResponse += content;
        }

        if (finishReason === "stop") {
          if (partialResponse.length > 0) {
            const assistantResponse: AssistantResponse = {
              content: partialResponse,
              responseType: partialResponse.includes("END_THE_CALL")
                ? ResponseType.END_CALL
                : ResponseType.SAY_FOR_VOICE,
            };
            console.log(`gpt: ${JSON.stringify(assistantResponse)}`);
            this.emit(
              "gptreply",
              assistantResponse,
              this.partialResponseIndex,
              interactionCount
            );
            this.partialResponseIndex++;
            partialResponse = "";
          } else {
            console.info(colorWarn(`gpt: GPT -> empty assistant prompt`));
          }
        }
      }

      this.updateUserContext({
        role: "assistant",
        content: completeResponse,
      });
      console.log(`gpt: GPT -> user context length: ${this.context.length}`);
    } catch (err) {
      console.log("gpt: error recieved");
      console.error(err);
      this.emit("gpterror", err);
    }
  }

  updateUserContext(message: Message) {
    this.context.push(message);
    const serializedMessage = JSON.stringify(message);
    redisClient.rPush(`${this.callSid}__transcription`, serializedMessage);
    console.log(`gpt: GPT -> user context length: ${this.context.length}`);
  }

  private async getCallTranscription(): Promise<
    Array<Message>
    // eslint-disable-next-line indent
  > {
    //TODO: throw error if providerData is undefined
    const providerData =
      ActiveCallConfig.getInstance().getCallConfig()?.providerData || {};
    const transcription = await this.initializeTranscription();
    if (transcription.length === 0) {
      // If transcription doesn't exist, initialize it with the system role message
      const systemRoleMessage = getSystemRoleMessage(providerData);
      await this.storeTranscription(systemRoleMessage);
      return [systemRoleMessage];
    }
    return transcription;
  }

  private async initializeTranscription() {
    const history = await redisClient.lRange(
      `${this.callSid}__transcription`,
      0,
      -1
    );
    return history.map((message) => JSON.parse(message) as Message);
  }

  private async storeTranscription(message: Message) {
    const serializedMessage = JSON.stringify(message);
    await redisClient.rPush(
      `${this.callSid}__transcription`,
      serializedMessage
    );
  }
}
