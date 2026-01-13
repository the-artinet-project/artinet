import { describe, it, expect } from "@jest/globals";
import {
  getAgentCard,
  convertToLangChainMessage,
  extractA2AMessage,
} from "../../src/langchain/utils";
import type * as sdk from "@artinet/sdk";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Mock ReactAgent for testing
const createMockAgent = (
  overrides: {
    name?: string;
    model?: string;
    tools?: Array<{
      name?: string;
      description?: string;
      getName?: () => string;
    }>;
  } = {}
) => ({
  options: {
    name: overrides.name,
    model: overrides.model ?? "gpt-4o",
    tools: overrides.tools ?? [],
  },
});

describe("LangChain utils", () => {
  describe("getAgentCard", () => {
    it("should create an agent card with provided name", async () => {
      const mockAgent = createMockAgent({
        name: "research-assistant",
        model: "gpt-4o",
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Research Assistant" },
      });

      expect(card.name).toBe("Research Assistant");
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(true);
      expect(card.capabilities.stateTransitionHistory).toBe(false);
      expect(card.defaultInputModes).toEqual(["text"]);
      expect(card.defaultOutputModes).toEqual(["text"]);
    });

    it("should use agent name when no card name provided", async () => {
      const mockAgent = createMockAgent({ name: "my-agent" });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      expect(card.name).toBe("my-agent");
    });

    it("should generate unique name when agent has no name", async () => {
      const mockAgent = createMockAgent({ name: undefined, model: "gpt-4o" });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      // Should generate a name based on model + uuid
      expect(card.name).toMatch(/^langchain-agent-gpt-4o/);
    });

    it("should convert tools to skills with name and description", async () => {
      const mockAgent = createMockAgent({
        tools: [
          { name: "search", description: "Search the web for information" },
          {
            name: "calculator",
            description: "Perform mathematical calculations",
          },
        ],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Tool Agent" },
      });

      expect(card.skills).toHaveLength(2);
      expect(card.skills[0]).toMatchObject({
        name: "search",
        description: "Search the web for information",
        tags: ["tool"],
      });
      expect(card.skills[1]).toMatchObject({
        name: "calculator",
        description: "Perform mathematical calculations",
        tags: ["tool"],
      });
    });

    it("should handle tools without name property gracefully", async () => {
      // Note: Tools without a proper 'name' property that don't pass isRunnableToolLike
      // will have an empty name. This tests the fallback behavior.
      const mockAgent = createMockAgent({
        tools: [
          {
            description: "A tool without a name",
          },
        ],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].name).toBe("");
      expect(card.skills[0].description).toBe("A tool without a name");
    });

    it("should handle agents with no tools", async () => {
      const mockAgent = createMockAgent({ tools: [] });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.skills).toHaveLength(0);
    });

    it("should use model as description", async () => {
      const mockAgent = createMockAgent({ model: "claude-3-sonnet" });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("claude-3-sonnet");
    });
  });

  describe("convertToLangChainMessage", () => {
    it("should convert user message to HumanMessage", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-1",
        role: "user",
        parts: [{ kind: "text", text: "Hello, LangChain!" }],
      };

      const langchainMessage = convertToLangChainMessage(a2aMessage);

      expect(langchainMessage).toBeInstanceOf(HumanMessage);
      expect(langchainMessage.content).toEqual([
        { type: "text", text: "Hello, LangChain!" },
      ]);
    });

    it("should convert agent message to AIMessage", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-2",
        role: "agent",
        parts: [{ kind: "text", text: "Hello, user!" }],
      };

      const langchainMessage = convertToLangChainMessage(a2aMessage);

      expect(langchainMessage).toBeInstanceOf(AIMessage);
      expect(langchainMessage.content).toEqual([
        { type: "text", text: "Hello, user!" },
      ]);
    });

    it("should handle multiple text parts", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-3",
        role: "user",
        parts: [
          { kind: "text", text: "First paragraph" },
          { kind: "text", text: "Second paragraph" },
        ],
      };

      const langchainMessage = convertToLangChainMessage(a2aMessage);

      expect(langchainMessage.content).toEqual([
        { type: "text", text: "First paragraph" },
        { type: "text", text: "Second paragraph" },
      ]);
    });

    it("should convert file parts", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-4",
        role: "user",
        parts: [
          {
            kind: "file",
            file: {
              uri: "https://example.com/image.png",
              mimeType: "image/png",
            },
          },
        ],
      };

      const langchainMessage = convertToLangChainMessage(a2aMessage);

      expect(langchainMessage.content).toEqual([
        {
          type: "file",
          data: { uri: "https://example.com/image.png", mimeType: "image/png" },
          mimeType: "image/png",
        },
      ]);
    });

    it("should convert data parts to non_standard type", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-5",
        role: "user",
        parts: [
          {
            kind: "data",
            data: { key: "value" },
          } as any,
        ],
      };

      const langchainMessage = convertToLangChainMessage(a2aMessage);

      expect(langchainMessage.content).toEqual([
        { type: "non_standard", value: { key: "value" } },
      ]);
    });
  });

  describe("extractA2AMessage", () => {
    it("should handle empty result", () => {
      const message = extractA2AMessage(
        "task-1",
        "ctx-1",
        null as any,
        {} as any
      );

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ kind: "text", text: "" });
    });

    it("should handle string result", () => {
      const message = extractA2AMessage(
        "task-1",
        "ctx-1",
        "Simple response" as any,
        {} as any
      );

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({
        kind: "text",
        text: "Simple response",
      });
    });

    it("should handle structured response", () => {
      const result = {
        structuredResponse: { answer: "42", confidence: 0.95 },
      };

      const message = extractA2AMessage(
        "task-1",
        "ctx-1",
        result as any,
        {} as any
      );

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({
        kind: "data",
        data: { answer: "42", confidence: 0.95 },
      });
    });

    it("should handle result with messages array", () => {
      const result = {
        messages: [
          { content: "First response" },
          { content: "Second response" },
        ],
      };

      const message = extractA2AMessage(
        "task-1",
        "ctx-1",
        result as any,
        {} as any
      );

      expect(message.parts).toHaveLength(2);
      expect(message.parts[0]).toEqual({
        kind: "text",
        text: "First response",
      });
      expect(message.parts[1]).toEqual({
        kind: "text",
        text: "Second response",
      });
    });

    it("should handle messages with content blocks", () => {
      const result = {
        messages: [
          {
            type: "ai",
            content: [
              { type: "text", text: "Block 1" },
              { type: "text", text: "Block 2" },
            ],
          },
        ],
      };

      const message = extractA2AMessage(
        "task-1",
        "ctx-1",
        result as any,
        {} as any
      );

      expect(message.parts).toHaveLength(1);
      // expect(message.parts[0]).toEqual({ kind: "text", text: "Block 1" });
      expect(message.parts[0]).toEqual({ kind: "text", text: "Block 2" });
    });

    it("should include taskId and contextId in message", () => {
      const message = extractA2AMessage(
        "my-task",
        "my-context",
        "test" as any,
        {} as any
      );

      expect(message.taskId).toBe("my-task");
      expect(message.contextId).toBe("my-context");
    });
  });
});
