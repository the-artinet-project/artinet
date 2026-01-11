import { describe, it, expect } from "@jest/globals";
import { getAgentCard, createStrandsMessage } from "../../src/strands/utils";
import type * as sdk from "@artinet/sdk";
import { TextBlock } from "@strands-agents/sdk";

// Mock StrandsAgent for testing
const createMockAgent = (
  overrides: {
    systemPrompt?: string | Array<{ type: string; text?: string }>;
    tools?: Array<{ name: string; description?: string }>;
  } = {}
) => ({
  systemPrompt: overrides.systemPrompt,
  tools: overrides.tools ?? [],
});

describe("Strands utils", () => {
  describe("getAgentCard", () => {
    it("should create an agent card with auto-generated name", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: "You are a helpful assistant",
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Strands Assistant" },
      });

      expect(card.name).toBe("Strands Assistant");
      expect(card.description).toBe("You are a helpful assistant");
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(true);
      expect(card.capabilities.stateTransitionHistory).toBe(false);
      expect(card.defaultInputModes).toEqual(["text"]);
      expect(card.defaultOutputModes).toEqual(["text"]);
    });

    it("should generate unique name when no card name provided", async () => {
      const mockAgent = createMockAgent();

      const card = await getAgentCard({
        agent: mockAgent as any,
      });

      // Should generate a name starting with "strands-agent-"
      expect(card.name).toMatch(/^strands-agent-/);
    });

    it("should use string systemPrompt as description", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: "You are a coding assistant",
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("You are a coding assistant");
    });

    it("should handle array systemPrompt with text blocks", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: [
          { type: "textBlock", text: "First instruction" },
          { type: "textBlock", text: "Second instruction" },
        ],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("First instruction\nSecond instruction");
    });

    it("should handle guardContentBlock in systemPrompt array", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: [
          { type: "guardContentBlock", text: { text: "Guard content" } },
        ],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("Guard content");
    });

    it("should handle string items in systemPrompt array", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: ["Simple string instruction"] as any,
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("Simple string instruction");
    });

    it("should return placeholder description when no systemPrompt", async () => {
      const mockAgent = createMockAgent({ systemPrompt: undefined });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("A Strands Agent that can perform tasks");
    });

    it("should convert tools to skills", async () => {
      const mockAgent = createMockAgent({
        tools: [
          { name: "search", description: "Search the web" },
          { name: "calculate", description: "Perform calculations" },
        ],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Tool Agent" },
      });

      expect(card.skills).toHaveLength(2);
      expect(card.skills).toEqual([
        {
          id: "search",
          name: "search",
          description: "Search the web",
          tags: ["tool"],
        },
        {
          id: "calculate",
          name: "calculate",
          description: "Perform calculations",
          tags: ["tool"],
        },
      ]);
    });

    it("should use default description for tools without description", async () => {
      const mockAgent = createMockAgent({
        tools: [{ name: "mystery_tool" }],
      });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.skills[0].description).toBe("Tool: mystery_tool");
    });

    it("should handle agents with no tools", async () => {
      const mockAgent = createMockAgent({ tools: [] });

      const card = await getAgentCard({
        agent: mockAgent as any,
        card: { name: "Agent" },
      });

      expect(card.skills).toHaveLength(0);
    });
  });

  describe("createStrandsMessage", () => {
    it("should convert user message to Strands Message with user role", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-1",
        role: "user",
        parts: [{ kind: "text", text: "Hello, Strands!" }],
      };

      const strandsMessage = createStrandsMessage(a2aMessage);

      expect(strandsMessage.role).toBe("user");
      // The Message object has content array
      expect(strandsMessage.content).toBeDefined();
    });

    it("should convert agent message to assistant role", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-2",
        role: "agent",
        parts: [{ kind: "text", text: "Hello, user!" }],
      };

      const strandsMessage = createStrandsMessage(a2aMessage);

      expect(strandsMessage.role).toBe("assistant");
    });

    it("should extract text content from message parts", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-3",
        role: "user",
        parts: [
          { kind: "text", text: "First" },
          { kind: "text", text: "Second" },
        ],
      };

      const strandsMessage = createStrandsMessage(a2aMessage);

      // The SDK's extractTextContent combines text parts
      expect(strandsMessage.content).toBeDefined();
      expect(strandsMessage.content.length).toBeGreaterThan(0);
    });

    it("should handle messages without text content", () => {
      const a2aMessage: sdk.A2A.Message = {
        kind: "message",
        messageId: "msg-4",
        role: "user",
        parts: [
          {
            kind: "file",
            file: {
              uri: "https://example.com/file.pdf",
              mimeType: "application/pdf",
            },
          },
        ],
      };
      const strandsMessage = createStrandsMessage(a2aMessage);

      // Should create a message with empty content when no text
      expect(strandsMessage.content).toEqual([
        new TextBlock("https://example.com/file.pdf"),
      ]);
    });

    it("should filter out non-text parts when creating message", () => {
      const a2aMessage: sdk.A2A.Message = {
        messageId: "msg-5",
        role: "user",
        parts: [
          { kind: "text", text: "Check this:" },
          {
            kind: "file",
            file: {
              uri: "https://example.com/image.png",
              mimeType: "image/png",
            },
          },
          { kind: "text", text: "What do you see?" },
        ],
      };

      const strandsMessage = createStrandsMessage(a2aMessage);

      // sdk.extractTextContent should combine the text parts
      expect(strandsMessage.content).toBeDefined();
      expect(strandsMessage.content.length).toBe(1);
      expect(strandsMessage.content[0]).toEqual(
        new TextBlock("Check this: What do you see?")
      );
    });
  });
});
