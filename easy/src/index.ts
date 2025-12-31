import OpenAI, { ClientOptions } from "openai";
import { AIAgentBuilder, AgentArgs } from "./builder.js";

export * from "@artinet/sdk";
export * from "./builder.js";
export * from "./executor.js";

/**
 * Creates a builder for constructing A2A agents that work with any OpenAI-compatible API.
 *
 * This is the main entry point for building agents with easy-a2a. The builder provides a fluent
 * API that lets you chain steps together to define your agent's behavior. Each step processes
 * messages sequentially, allowing you to build complex workflows with simple, composable functions.
 *
 * @param client - The OpenAI client configuration. Can be either:
 *   - An OpenAI instance: Pass a pre-configured OpenAI client for full control
 *   - ClientOptions: Pass configuration options (apiKey, baseURL, etc.) and a client will be created automatically
 *
 * @param agents - Optional. Additional A2A agents that this agent can communicate with.
 *   When provided, these agents are automatically converted into tools that the AI can call.
 *   Accepts:
 *   - AgentRelay: A relay instance that manages multiple agents
 *   - AgentRelayConfig: Configuration object with `callerId` and `agents` Map
 *   - A2AService or A2AClient: A single agent instance
 *
 * @returns An OpenaiEngineBuilder instance with chainable methods for building your agent workflow.
 *
 * @example
 * // Simple agent with system prompt
 * import { a2a } from "easy-a2a";
 *
 * const agent = a2a({ apiKey: "your-api-key" })
 *   .ai("You are a helpful assistant.")
 *   .createAgent({ agentCard: "MyAgent" });
 *
 * const result = await agent.sendMessage("Hello!");
 *
 * @example
 * // Use OpenRouter or other OpenAI-compatible APIs
 * const agent = a2a({
 *   baseURL: "https://openrouter.ai/api/v1",
 *   apiKey: "your-openrouter-key"
 * })
 *   .ai("You are a helpful assistant.")
 *   .createAgent({ agentCard: "MyAgent" });
 *
 * @example
 * // Multi-agent setup - AI agent that can call other agents
 * import { AgentBuilder } from "easy-a2a";
 *
 * const helperAgent = AgentBuilder()
 *   .text(({ content }) => `Echo: ${content}`)
 *   .createAgent({ agentCard: "Helper" });
 *
 * const mainAgent = a2a(
 *   { apiKey: "your-api-key" },
 *   {
 *     callerId: "main-agent",
 *     agents: new Map([["helper", helperAgent]])
 *   }
 * )
 *   .ai("Use the helper agent when users want to echo messages.")
 *   .createAgent({ agentCard: "MainAgent" });
 *
 * // The AI can now call the helper agent as a tool
 * await mainAgent.sendMessage("Echo 'Hello World' using the helper");
 *
 * @example
 * // Multi-step workflow
 * const agent = a2a({ apiKey: "your-api-key" })
 *   .text(({ content }) => `Received: ${content}`)
 *   .ai("Process the user's request concisely.")
 *   .text(({ args }) => {
 *     const completion = args[0];
 *     return `Token usage: ${completion.usage?.total_tokens}`;
 *   })
 *   .createAgent({ agentCard: "MyAgent" });
 *
 * @example
 * // Reuse the same OpenAI client across multiple agents
 * import { OpenAI } from "openai";
 *
 * const client = new OpenAI({ apiKey: "your-api-key" });
 *
 * const agent1 = a2a(client)
 *   .ai("You help with cooking.")
 *   .createAgent({ agentCard: "CookingAgent" });
 *
 * const agent2 = a2a(client)
 *   .ai("You help with travel.")
 *   .createAgent({ agentCard: "TravelAgent" });
 */
export default function a2a(
  client: OpenAI | ClientOptions,
  agents?: AgentArgs
) {
  return AIAgentBuilder(client, agents);
}
