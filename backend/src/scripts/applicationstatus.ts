import OpenAI from "openai";
import { CallLogKeys, CallLogService } from "service/calllog-service";
import { MODELS } from "types/openai";
import { colorErr, colorInfo } from "utils/colorCli";
import { OPEN_AI_KEY } from "utils/config";
import { applicationStatusJsonPrompt } from "utils/prompts";

export const generateApplicationStatusJson = async (callSid: string) => {
  try {
    const transcription = await CallLogService.get(
      callSid,
      CallLogKeys.APPLICATION_STATUS,
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
    return JSON.parse(applicationStatusJson);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(
      colorErr(err?.message || "Failed to generate Application Status Json."),
    );
    return false;
  }
};
