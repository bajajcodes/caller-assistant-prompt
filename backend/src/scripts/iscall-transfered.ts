import OpenAI from "openai";
import { MODELS } from "types/openai";
import { colorErr, colorInfo } from "utils/colorCli";
import { OPEN_AI_KEY } from "utils/config";
import { callTransferAnalyzer } from "utils/prompts";

export const isCallTransfered = async (userInput: string) => {
  try {
    const openaiClient = new OpenAI({ apiKey: OPEN_AI_KEY });
    const completeion = await openaiClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: callTransferAnalyzer,
        },
        {
          role: "user",
          content: userInput,
        },
      ],
      model: MODELS.GPT_4_TUBRO,
      temperature: 0,
      max_tokens: 3,
    });
    const message = completeion.choices[0].message.content;
    const isTransfered = message ? ["Yes", "yes"].includes(message) : false;
    console.log(
      colorInfo(
        `call transfered -> isTransfered:${isTransfered} message: ${message} transcription:${userInput}`,
      ),
    );
    return isTransfered;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(
      colorErr(err?.message || "Failed to analyze is Call Transfered."),
    );
    return false;
  }
};
