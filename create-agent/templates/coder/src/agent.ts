import { orc8, getHistory } from "orc8";
import { openaiProvider } from "orc8/openai";
import { AgentEngine, cr8 } from "@artinet/sdk";

export const demoAgent: AgentEngine = cr8("Coder Agent")
  .text(async ({ context }) => {
    const task = await context.getTask();
    task.history = [...(task.history ?? []), context.userMessage];
    const messages = getHistory(task);
    return {
      reply: [`Generating code...`],
      args: {
        messages,
      },
    };
  })
  .text(async ({ args }) => {
    const o8 = orc8.create({
      modelId: "deepseek-ai/DeepSeek-R1",
      provider: openaiProvider({ apiKey: process.env.OPENAI_API_KEY }),
    });
    return await o8.connect([
      {
        role: "system",
        content:
          "You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.",
      },
      ...(args?.messages ?? []),
    ]);
  }).engine;
