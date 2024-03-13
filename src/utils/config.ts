import dotenv from "dotenv";

dotenv.config();

const OPEN_AI_KEY = process.env.OPEN_AI_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PORT = process.env.PORT;
const REDIS_CLIENT_URL = process.env.REDIS_CLIENT_URL;

export {
  DEEPGRAM_API_KEY,
  OPEN_AI_KEY,
  PORT,
  REDIS_CLIENT_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
};
