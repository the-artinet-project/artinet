import { describe, it, expect } from "@jest/globals";
import {
  getAgentCard,
  convertToAgentInputItem,
  extractA2AMessage,
} from "../../src/openai/utils";
import type * as sdk from "@artinet/sdk";

// Mock OpenAI Agent
const createMockAgent = (
  overrides: {
    name?: string;
    instructions?: string | (() => string);
    handoffDescription?: string;
    tools?: Array<{ name: string; description?: string }>;
  } = {}
) => ({
  name: overrides.name ?? "test-agent",
  instructions: overrides.instructions ?? "Test instructions",
  handoffDescription: overrides.handoffDescription ?? "",
  tools: overrides.tools ?? [],
  // Other required Agent properties (not used in card generation)
  model: "gpt-4",
  modelSettings: {},
  handoffs: [],
  mcpServers: [],
  inputGuardrails: [],
  outputGuardrails: [],
  outputType: "text" as const,
  toolUseBehavior: "run_llm_again" as const,
  resetToolChoice: true,
});

describe("OpenAI utils", () => {
  describe("getAgentCard", () => {
    it("should create an agent card with basic agent info", async () => {
      const mockAgent = createMockAgent({
        name: "my-assistant",
        handoffDescription: "A helpful assistant that answers questions",
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "My Assistant" },
      });

      expect(card.name).toBe("My Assistant");
      expect(card.description).toBe(
        "A helpful assistant that answers questions"
      );
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(true);
      expect(card.capabilities.stateTransitionHistory).toBe(false);
      expect(card.defaultInputModes).toEqual(["text"]);
      expect(card.defaultOutputModes).toEqual(["text"]);
    });

    it("should use agent name when no card name provided", async () => {
      const mockAgent = createMockAgent({ name: "default-agent" });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      expect(card.name).toBe("default-agent");
    });

    it("should prefer handoffDescription for description", async () => {
      const mockAgent = createMockAgent({
        instructions: "Internal system prompt",
        handoffDescription: "Public description for users",
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      expect(card.description).toBe("Public description for users");
    });

    it("should handle empty handoffDescription", async () => {
      const mockAgent = createMockAgent({
        instructions: "You are a helpful assistant",
        handoffDescription: "",
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      // handoffDescription is used directly (even when empty)
      expect(card.description).toBe("");
    });

    it("should convert tools to skills", async () => {
      const mockAgent = createMockAgent({
        tools: [
          { name: "search", description: "Search the web" },
          { name: "calculate", description: "Perform math calculations" },
        ],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Tool Agent" },
      });

      expect(card.skills).toHaveLength(2);
      expect(card.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "search",
            name: "search",
            description: "Search the web",
            tags: ["tool"],
          }),
          expect.objectContaining({
            id: "calculate",
            name: "calculate",
            description: "Perform math calculations",
            tags: ["tool"],
          }),
        ])
      );
    });

    it("should use default description for tools without description", async () => {
      const mockAgent = createMockAgent({
        tools: [{ name: "mystery_tool" }],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      expect(card.skills[0].description).toBe(
        "A tool that can be used to mystery_tool"
      );
    });

    it("should handle agents with no tools", async () => {
      const mockAgent = createMockAgent({
        tools: [],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      expect(card.skills).toHaveLength(0);
    });
  });

  describe("convertToAgentInputItem", () => {
    it("should convert user message with text part to user message item", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-1",
        role: "user",
        parts: [{ kind: "text", text: "Hello, agent!" }],
      };

      const inputItem = convertToAgentInputItem(a2aMessage);

      expect(inputItem.type).toBe("message");
      expect(inputItem.role).toBe("user");
      expect(inputItem.content).toEqual([
        { type: "input_text", text: "Hello, agent!" },
      ]);
    });

    it("should convert agent message to assistant role with output_text", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-2",
        role: "agent",
        parts: [{ kind: "text", text: "Hello, user!" }],
      };

      const inputItem = convertToAgentInputItem(a2aMessage);

      expect(inputItem.type).toBe("message");
      expect(inputItem.role).toBe("assistant");
      expect(inputItem).toHaveProperty("status", "completed");
      expect(inputItem.content).toEqual([
        { type: "output_text", text: "Hello, user!" },
      ]);
    });

    it("should convert multiple text parts", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-3",
        role: "user",
        parts: [
          { kind: "text", text: "First line" },
          { kind: "text", text: "Second line" },
        ],
      };

      const inputItem = convertToAgentInputItem(a2aMessage);

      expect(inputItem.content).toEqual([
        { type: "input_text", text: "First line" },
        { type: "input_text", text: "Second line" },
      ]);
    });

    it("should convert file parts to input_file items", () => {
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

      const inputItem = convertToAgentInputItem(a2aMessage);

      expect(inputItem.content).toEqual([
        { type: "input_file", file: "https://example.com/image.png" },
      ]);
    });

    it("should convert data parts to JSON text", () => {
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

      const inputItem = convertToAgentInputItem(a2aMessage);

      expect(inputItem.content).toEqual([
        { type: "input_text", text: '{"key":"value"}' },
      ]);
    });

    it("should filter non-text content from assistant messages", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-6",
        role: "agent",
        parts: [
          { kind: "text", text: "Here is the result:" },
          {
            kind: "file",
            file: {
              uri: "https://example.com/file.pdf",
              mimeType: "application/pdf",
            },
          },
          { kind: "text", text: "Done!" },
        ],
      };

      const inputItem = convertToAgentInputItem(a2aMessage);

      // Assistant messages filter out non-text content
      expect(inputItem.content).toEqual([
        { type: "output_text", text: "Here is the result:" },
        { type: "output_text", text: "Done!" },
      ]);
    });
  });

  describe("extractA2AMessage", () => {
    it("should extract string finalOutput as text part", () => {
      const result = { finalOutput: "Hello, world!" };

      const message = extractA2AMessage("task-1", "ctx-1", result as any);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ kind: "text", text: "Hello, world!" });
    });

    it("should return empty text when finalOutput is undefined", () => {
      const result = { finalOutput: undefined };

      const message = extractA2AMessage("task-1", "ctx-1", result as any);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ kind: "text", text: "" });
    });

    it("should return empty text when finalOutput is missing", () => {
      const result = {};

      const message = extractA2AMessage("task-1", "ctx-1", result as any);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ kind: "text", text: "" });
    });

    it("should return newItems text when finalOutput is missing", () => {
      const result = {
        newItems: [
          {
            type: "message_output_item",
            content: "Hello, world!",
          },
        ],
      };

      const message = extractA2AMessage("task-1", "ctx-1", result as any);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ kind: "text", text: "Hello, world!" });
    });

    it("should convert structured output to data part", () => {
      const result = {
        finalOutput: {
          name: "John",
          age: 30,
          active: true,
        },
      };

      const message = extractA2AMessage("task-1", "ctx-1", result as any);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({
        kind: "data",
        data: { name: "John", age: 30, active: true },
      });
    });

    it("should include taskId and contextId in message", () => {
      const result = { finalOutput: "test" };

      const message = extractA2AMessage("my-task", "my-context", result as any);

      expect(message.taskId).toBe("my-task");
      expect(message.contextId).toBe("my-context");
    });
  });
});
