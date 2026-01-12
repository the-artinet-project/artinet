/**
 * Claude Agent Integration Tests
 *
 * These tests hit real LLMs using ANTHROPIC_API_KEY from the environment.
 * They are skipped if the API key is not available.
 *
 * Note: Claude Agent SDK uses streaming queries and requires proper API setup.
 */
import { describe, it, expect, beforeAll } from "@jest/globals";
import { INTEGRATION_TIMEOUT } from "../setup";
import { dock } from "../../src/claude";
const hasApiKey = !!process.env.OPENAI_API_KEY;
describe("Claude Integration", () => {
  beforeAll(() => {
    if (!hasApiKey) {
      console.log("Skipping: OPENAI_API_KEY not set");
    }
  });

  it(
    "should run a Claude query and receive streaming response",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      const a2agent = await dock(
        {
          model: "claude-sonnet-4-20250514",
          maxTurns: 1,
        },
        { name: "TestBot" }
      );

      const task = await a2agent
        .sendMessage("What is 5 + 5? Reply with just the number.")
        .catch((error) => {
          console.error(error);
          return null;
        });
      expect((task as any).status.message?.parts[0].text).toMatch(/10/);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    "should handle Claude agent with system prompt",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: OPENAI_API_KEY not set");
        return;
      }

      const a2agent = await dock(
        {
          systemPrompt:
            "Your name is TestBot. Always introduce yourself when asked about your name.",
          model: "claude-sonnet-4-20250514",
          maxTurns: 1,
        },
        { name: "TestBot" }
      );

      const task = await a2agent
        .sendMessage("What is your name?")
        .catch((error) => {
          console.error(error);
          return null;
        });
      expect((task as any).status.message?.parts[0]?.text).toMatch(/TestBot/);
    },
    INTEGRATION_TIMEOUT
  );
});
