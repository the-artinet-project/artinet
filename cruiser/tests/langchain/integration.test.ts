import { describe, it, expect, beforeAll } from "@jest/globals";
import * as langchain from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { INTEGRATION_TIMEOUT } from "../setup";
import { dock } from "../../src/langchain";
import * as artinet from "@artinet/sdk";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const baseURL = process.env.INFERENCE_PROVIDER_URL;

describe("LangChain Integration", () => {
  beforeAll(() => {
    if (!hasApiKey) {
      console.log(
        "Skipping LangChain integration tests: OPENAI_API_KEY not set"
      );
    }
    if (baseURL) {
      console.log(`Using custom inference provider: ${baseURL}`);
    }
  });

  it(
    "should create and run a LangChain agent with real LLM",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      // Use OpenRouter model format if using custom provider
      const modelName = baseURL ? "openai/gpt-4o-mini" : "gpt-4o-mini";

      const model = new ChatOpenAI({
        model: modelName,
        apiKey: process.env.OPENAI_API_KEY,
        configuration: baseURL ? { baseURL } : undefined,
      });

      const langchainAgent: langchain.ReactAgent = langchain.createAgent({
        model,
        tools: [],
        name: "test-langchain-agent",
      });

      const artinetAgent: artinet.Agent = await dock(langchainAgent);

      const result: artinet.A2A.Task | artinet.A2A.Message =
        await artinetAgent.sendMessage(
          "What is 4 + 4? Reply with just the number."
        );

      expect(result).toBeDefined();
      expect(result.status.message?.parts).toBeDefined();
      expect(result.status.message?.parts.length).toBeGreaterThan(0);

      // Extract the AI response
      const lastMessage =
        result.status.message?.parts[result.status.message?.parts.length - 1];
      expect(lastMessage?.kind).toBe("text");
      expect(lastMessage?.text).toBeDefined();
      expect(lastMessage?.text).toMatch(/8/);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    "should handle multi-turn conversation with LangChain agent",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      const modelName = baseURL ? "openai/gpt-4o-mini" : "gpt-4o-mini";

      const model = new ChatOpenAI({
        model: modelName,
        apiKey: process.env.OPENAI_API_KEY,
        configuration: baseURL ? { baseURL } : undefined,
      });

      const agent = langchain.createAgent({
        model,
        tools: [],
        name: "memory-langchain-agent",
      });

      // First turn
      const artinetAgent = await dock(agent);
      const result1 = await artinetAgent.sendMessage(
        "My favorite color is blue. Remember this."
      );
      const taskId = (result1 as artinet.A2A.Task).id;
      expect(result1.status.message?.parts).toBeDefined();

      // Second turn - pass entire message history
      const result2 = await artinetAgent.sendMessage(
        artinet.describe.message({
          role: "user",
          taskId,
          parts: [artinet.describe.part.text("What is my favorite color?")],
        })
      );
      expect(result2.status.message?.parts).toBeDefined();

      const lastMessage =
        result2.status.message?.parts[result2.status.message?.parts.length - 1];
      expect(lastMessage?.kind).toBe("text");
      expect(lastMessage?.text).toBeDefined();
      expect(lastMessage?.text).toMatch(/blue/);
    },
    INTEGRATION_TIMEOUT
  );
});
