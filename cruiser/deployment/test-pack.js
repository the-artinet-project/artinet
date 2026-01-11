#!/usr/bin/env node
import { park as parkMastra } from "@artinet/cruiser/mastra";
import { park as parkOpenAI } from "@artinet/cruiser/openai";
import { park as parkClaude } from "@artinet/cruiser/claude";
import { park as parkLangchain } from "@artinet/cruiser/langchain";
import { park as parkStrands } from "@artinet/cruiser/strands";
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

const LangChainAgent = await parkLangchain(langchainAgent)
  .catch((error) => {
    console.error("Error parking LangChain agent:", error);
    return null;
  })
  .catch((error) => {
    console.error("Error parking LangChain agent:", error);
    return null;
  });
if (LangChainAgent) {
  console.log("✔️ Langchain agent parked successfully");
}

const ClaudeAgent = await parkClaude(
  {
    model: "claude-sonnet-4-20250514",
    maxTurns: 1,
  },
  { name: "TestBot" }
).catch((error) => {
  console.error("Error parking Claude agent:", error);
  return null;
});

if (ClaudeAgent) {
  console.log("✔️ Claude agent parked successfully");
}

// Use agents from different frameworks
const researcher = await parkOpenAI(
  new OpenAIAgent({ name: "researcher", instructions: "Research topics" }),
  { name: "Researcher" }
).catch((error) => {
  console.error("Error parking OpenAI agent:", error);
  return null;
});

if (researcher) {
  console.log("✔️ OpenAI agent parked successfully");
}

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(baseURL && { baseURL }),
});

const openaiModel = openai("gpt-4o-mini");

const writer = await parkMastra(
  new MastraAgent({
    name: "writer",
    instructions: "Write content",
    model: openaiModel,
  }),
  { name: "Writer" }
).catch((error) => {
  console.error("Error parking Mastra agent:", error);
  return null;
});

if (writer) {
  console.log("✔️ Mastra agent parked successfully");
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

const strandsArtinetAgent = await parkStrands(strandsAgent).catch((error) => {
  console.error("Error parking Strands agent:", error);
  return null;
});

if (strandsArtinetAgent) {
  console.log("✔️ Strands agent parked successfully");
}

console.log("✅ All agents parked");
process.exit(0);
