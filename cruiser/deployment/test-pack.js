#!/usr/bin/env node
import { dock as dockMastra } from "@artinet/cruiser/mastra";
import { dock as dockOpenAI } from "@artinet/cruiser/openai";
import { dock as dockClaude } from "@artinet/cruiser/claude";
import { dock as dockLangchain } from "@artinet/cruiser/langchain";
import { dock as dockStrands } from "@artinet/cruiser/strands";
import { Agent as MastraAgent } from "@mastra/core/agent";
import { Agent as OpenAIAgent } from "@openai/agents";
import { createOpenAI } from "@ai-sdk/openai";
import * as langchain from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { Agent as StrandsAgent } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/openai";
const baseURL = process.env.INFERENCE_PROVIDER_URL;

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: baseURL ? { baseURL: baseURL } : undefined,
});
const langchainAgent = langchain.createAgent({
  model,
  tools: [],
  name: "test-langchain-agent",
});

const LangChainAgent = await dockLangchain(langchainAgent)
  .catch((error) => {
    console.error("Error docking LangChain agent:", error);
    return null;
  })
  .catch((error) => {
    console.error("Error docking LangChain agent:", error);
    return null;
  });
if (LangChainAgent) {
  console.log("✔️ Langchain agent docked successfully");
}

const ClaudeAgent = await dockClaude(
  {
    model: "claude-sonnet-4-20250514",
    maxTurns: 1,
  },
  { name: "TestBot" }
).catch((error) => {
  console.error("Error docking Claude agent:", error);
  return null;
});

if (ClaudeAgent) {
  console.log("✔️ Claude agent docked successfully");
}

// Use agents from different frameworks
const researcher = await dockOpenAI(
  new OpenAIAgent({ name: "researcher", instructions: "Research topics" }),
  { name: "Researcher" }
).catch((error) => {
  console.error("Error docking OpenAI agent:", error);
  return null;
});

if (researcher) {
  console.log("✔️ OpenAI agent docked successfully");
}

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(baseURL && { baseURL }),
});

const openaiModel = openai("gpt-4o-mini");

const writer = await dockMastra(
  new MastraAgent({
    name: "writer",
    instructions: "Write content",
    model: openaiModel,
  }),
  { name: "Writer" }
).catch((error) => {
  console.error("Error docking Mastra agent:", error);
  return null;
});

if (writer) {
  console.log("✔️ Mastra agent docked successfully");
}

const strandsModel = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY,
  clientConfig: {
    baseURL,
  },
  modelId: "gpt-4o-mini",
});
const strandsAgent = new StrandsAgent({
  model: strandsModel,
  systemPrompt: "You are a helpful assistant. Respond briefly.",
});

const strandsArtinetAgent = await dockStrands(strandsAgent).catch((error) => {
  console.error("Error docking Strands agent:", error);
  return null;
});

if (strandsArtinetAgent) {
  console.log("✔️ Strands agent docked successfully");
}

console.log("✅ All agents docked");
process.exit(0);
