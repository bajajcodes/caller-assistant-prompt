import { connectOpenAI } from "service/openai";

connectOpenAI()
  .then((client) => {
    console.log(`Connected To openAI`);
    return client;
  })
  .catch(() => {
    console.error(`Failed To Connect To openAI`);
  });
