import { orc8, getHistory } from "orc8";
import { openaiProvider } from "orc8/openai";
import { AgentEngine, cr8, getParts, getPayload, Agent } from "@artinet/sdk";
import { codingAgentCard } from "./lib/index.js";

export const codingAgent: Agent = cr8("Coding Agent")
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
    return await orc8
      .create({
        modelId: "gpt-4o-mini",
        provider: openaiProvider({ apiKey: process.env.OPENAI_API_KEY }),
      })
      .connect([
        {
          role: "system",
          content: [
            "You are an expert coding assistant.",
            "Provide a high-quality code sample according to the output instructions provided below.",
            "You may generate multiple files as needed.",
          ].join(" "),
        },
        ...(args?.messages ?? []),
      ]);
  }).agent;

export const demoAgent: AgentEngine = orc8
  .create({
    modelId: "gpt-4o-mini",
    provider: openaiProvider({ apiKey: process.env.OPENAI_API_KEY }),
    instructions: [
      "You are an orchestration agent.",
      "You will be given a request and you will need to pick the best agent to execute the request.",
      "Finally, you will need to synthesize the response from the agents and return the final response to the user.",
    ].join(" "),
  })
  .add(codingAgent).engine;
