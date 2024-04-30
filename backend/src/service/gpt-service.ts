import EventEmitter from "events";
import OpenAI from "openai";
import { ChatCompletionSystemMessageParam } from "openai/resources/index.mjs";
import { AssistantResponse, MODELS } from "types/openai";
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

  async completion(text: string) {
    try {
      this.updateUserContext({ role: "user", content: text });
      const model =
        ActiveCallConfig.getInstance().getCallConfig()?.callModel ||
        MODELS.GPT_4_TUBRO;
      console.info(`gpt: model: ${model}`);
      const completeion = await this.openaiClient.chat.completions.create({
        messages: this.context,
        model,
        response_format: {
          type: "json_object",
        },
        temperature: 0,
        max_tokens: 100,
      });

      console.log(completeion.choices[0].message.content);
      const assistantPrompt = completeion.choices[0].message.content;

      console.log(`gpt: ${JSON.stringify(assistantPrompt)}`);
      if (!assistantPrompt) {
        console.info(`gpt: GPT -> invalid assistant prompt`);
      } else {
        const assistantResponse = JSON.parse(
          assistantPrompt
        ) as AssistantResponse;

        this.emit("gptreply", assistantResponse);
        this.updateUserContext({
          role: "assistant",
          content: assistantResponse.content,
        });
        console.log(`gpt: GPT -> user context length: ${this.context.length}`);
      }
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
    const providerDataStringified = await redisClient.get(
      `${this.callSid}__providerdata`
    );
    const providerData = providerDataStringified
      ? JSON.parse(providerDataStringified)
      : {};
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
