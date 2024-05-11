import OpenAI from "openai";
import { redisClient } from "service/redis";
import { Message } from "types/call";
import { MODELS } from "types/openai";
import { colorErr, colorInfo } from "utils/colorCli";
import { OPEN_AI_KEY } from "utils/config";
import { applicationStatusJsonPrompt } from "utils/prompts";

export const generateApplicationStatusJson = async (callSid: string) => {
  try {
    const callTranscription = await redisClient.lRange(
      `${callSid}__transcription`,
      0,
      -1
    );
    if (!callTranscription.length) {
      return null;
    }
    const transcriptionParsed = callTranscription.map(
      (message) => JSON.parse(message) as Message
    );
    const transcription = transcriptionParsed.filter(
      (transcript) =>
        transcript.role === "user" || transcript.role === "assistant"
    );
    const transcriptionString = JSON.stringify(transcription);
    const systemPrompt = applicationStatusJsonPrompt.base
      .replace("{Document}", applicationStatusJsonPrompt.document)
      .replace("{Transcription}", transcriptionString);
    const openaiClient = new OpenAI({ apiKey: OPEN_AI_KEY });
    const completeion = await openaiClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content:
            "Please generate the corresponding JSON output following the rules and structure specified in the document.",
        },
      ],
      model: MODELS.GPT_4_TUBRO,
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const applicationStatusJson = completeion.choices[0].message.content;
    console.log(colorInfo(`applicationstatus json ->  generated`));
    if (!applicationStatusJson) {
      return null;
    }
    redisClient.del(`${callSid}__callstatus`);
    redisClient.del(`${callSid}__transcription`);
    redisClient.del(`${callSid}__ivr--transcription`);
    return JSON.parse(applicationStatusJson);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(
      colorErr(err?.message || "Failed to generate Application Status Json.")
    );
    return false;
  }
};
