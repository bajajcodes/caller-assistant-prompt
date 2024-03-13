import dotenv from "dotenv";

dotenv.config();

const OPEN_AI_KEY = process.env.OPEN_AI_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PORT = process.env.PORT;

export {
  DEEPGRAM_API_KEY,
  OPEN_AI_KEY,
  PORT,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
};
