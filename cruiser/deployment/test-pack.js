#!/usr/bin/env node
import { dock as dockMastra } from "@artinet/cruiser/mastra";
import { dock as dockOpenAI } from "@artinet/cruiser/openai";
import { dock as dockClaude } from "@artinet/cruiser/claude";
import { dock as dockLangchain } from "@artinet/cruiser/langchain";
import { dock as dockStrands } from "@artinet/cruiser/strands";
import { Agent as MastraAgent } from "@mastra/core/agent";
import { Agent as OpenAIAgent, setDefaultOpenAIClient } from "@openai/agents";
import { OpenAI } from "openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import * as langchain from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { Agent as StrandsAgent } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/openai";
import { cr8, applyDefaults } from "@artinet/sdk";
const baseURL = process.env.INFERENCE_PROVIDER_URL;

// applyDefaults();

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: String(process.env.OPENAI_API_KEY).trim(),
  configuration: baseURL ? { baseURL: baseURL } : undefined,
});

const langchainAgent = await dockLangchain(
  langchain.createAgent({
    model,
    tools: [],
    name: "test-langchain-agent",
  })
).catch((error) => {
  console.error("Error docking LangChain agent:", error);
  return null;
});

if (langchainAgent) {
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

const openaiClient = new OpenAI({
  apiKey: String(process.env.OPENAI_API_KEY).trim(),
  ...(baseURL && { baseURL }),
});
setDefaultOpenAIClient(openaiClient);
// Use agents from different frameworks
const openaiAgent = await dockOpenAI(
  new OpenAIAgent({ name: "researcher", instructions: "Research topics" }),
  { name: "Researcher" }
).catch((error) => {
  console.error("Error docking OpenAI agent:", error);
  return null;
});

if (openaiAgent) {
  console.log("✔️ OpenAI agent docked successfully");
}

const router = createOpenRouter({
  apiKey: String(process.env.OPENAI_API_KEY).trim(),
  ...(baseURL && { baseURL }),
});

const openaiModel = router("gpt-4o-mini");

const mastraAgent = await dockMastra(
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

if (mastraAgent) {
  console.log("✔️ Mastra agent docked successfully");
}

const strandsModel = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY,
  clientConfig: {
    baseURL,
  },
  modelId: "gpt-4o-mini",
});

const strandsAgent = await dockStrands(
  new StrandsAgent({
    model: strandsModel,
    systemPrompt: "You are a helpful assistant. Respond briefly.",
  })
).catch((error) => {
  console.error("Error docking Strands agent:", error);
  return null;
});

if (strandsAgent) {
  console.log("✔️ Strands agent docked successfully");
}

console.log("✅ All agents docked");

const orchestrator = cr8("TestOrchestrator")
  .sendMessage({ agent: mastraAgent })
  .sendMessage({ agent: strandsAgent })
  .sendMessage({ agent: langchainAgent })
  .sendMessage({ agent: openaiAgent }).agent;

const response = await orchestrator.sendMessage(
  "What is the capital of France?"
);
console.log(JSON.stringify(response, null, 2));

process.exit(0);
