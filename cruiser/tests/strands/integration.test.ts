import { describe, it, expect, beforeAll } from "@jest/globals";
import { Agent as StrandsAgent } from "@strands-agents/sdk";
import { INTEGRATION_TIMEOUT } from "../setup";
import { OpenAIModel } from "@strands-agents/sdk/openai";
import { park } from "../../src/strands";
import * as sdk from "@artinet/sdk";
const hasApiKey = !!process.env.OPENAI_API_KEY;
const baseURL = process.env.INFERENCE_PROVIDER_URL;

describe("Strands Integration", () => {
  const model = new OpenAIModel({
    apiKey: process.env.OPENAI_API_KEY,
    clientConfig: {
      baseURL,
    },
    modelId: "gpt-4o-mini",
  });
  beforeAll(() => {
    if (!hasApiKey) {
      console.log("Skipping Strands integration tests: OPENAI_API_KEY not set");
    }
    if (baseURL) {
      console.log(`Using custom inference provider: ${baseURL}`);
    }
  });

  it(
    "should create and invoke a Strands agent with real LLM",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      const agent = new StrandsAgent({
        model,
        systemPrompt: "You are a helpful assistant. Respond briefly.",
      });

      const artinetAgent = await park(agent);
      const result = await artinetAgent.sendMessage(
        "What is 6 + 6? Reply with just the number."
      );

      expect(result).toBeDefined();
      expect(result.status.message?.parts).toBeDefined();
      expect(result.status.message?.parts.length).toBeGreaterThan(0);
      expect(result.status.message?.parts[0].kind).toBe("text");
      expect(result.status.message?.parts[0].text).toBeDefined();
      expect(result.status.message?.parts[0].text).toMatch(/12/);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    "should handle multi-turn conversation with Strands agent",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      const agent = new StrandsAgent({
        model,
        systemPrompt:
          "You are a helpful assistant. Remember context from previous messages.",
      });

      // First turn
      const artinetAgent = await park(agent);
      const result1 = await artinetAgent.sendMessage(
        "Remember this code: XYZ123. Confirm you have remembered it."
      );
      expect(result1).toBeDefined();

      // Second turn - agent maintains message history internally
      const result2 = await artinetAgent.sendMessage(
        sdk.describe.message({
          taskId: (result1 as sdk.A2A.Task).id,
          role: "user",
          parts: [sdk.describe.part.text("What was the code I gave you?")],
        })
      );

      expect(result2).toBeDefined();
      expect(result2.status.message?.parts).toBeDefined();
      expect(result2.status.message?.parts.length).toBeGreaterThan(0);
      expect(result2.status.message?.parts[0].kind).toBe("text");
      expect(result2.status.message?.parts[0].text).toBeDefined();
      expect(result2.status.message?.parts[0].text).toMatch(/XYZ123/i);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    "should return stop reason in agent result",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      const agent = new StrandsAgent({
        model,
        systemPrompt: "You are a helpful assistant.",
      });

      const artinetAgent = await park(agent);
      const result = await artinetAgent.sendMessage("Say hello.");

      expect(result).toBeDefined();
      expect(result.status.message?.parts).toBeDefined();
      expect(result.status.message?.parts.length).toBeGreaterThan(0);
      expect(result.status.message?.metadata).toBeDefined();
      expect(result.status.message?.metadata?.result?.stopReason).toBeDefined();
    },
    INTEGRATION_TIMEOUT
  );
});
