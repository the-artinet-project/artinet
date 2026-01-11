import { describe, it, expect } from "@jest/globals";
import { getAgentCard, extractA2AMessage } from "../../src/claude/utils";
import type * as sdk from "@artinet/sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

// Mock ClaudeAgent (Options type) for testing
const createMockAgent = (
  overrides: {
    systemPrompt?: string;
    tools?: string[];
    allowedTools?: string[];
  } = {}
) => ({
  systemPrompt: overrides.systemPrompt,
  tools: overrides.tools,
  allowedTools: overrides.allowedTools,
});

describe("Claude utils", () => {
  describe("getAgentCard", () => {
    it("should create an agent card with auto-generated name", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: "You are a helpful coding assistant",
      });

      const card = await getAgentCard({
        agent: mockAgent,
        card: { name: "Claude Coder" },
      });

      expect(card.name).toBe("Claude Coder");
      expect(card.description).toBe("You are a helpful coding assistant");
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(true);
      expect(card.capabilities.stateTransitionHistory).toBe(false);
      expect(card.defaultInputModes).toEqual(["text"]);
      expect(card.defaultOutputModes).toEqual(["text"]);
    });

    it("should generate unique name when no card name provided", async () => {
      const mockAgent = createMockAgent();

      const card = await getAgentCard({
        agent: mockAgent,
      });

      // Should generate a name starting with "claude-agent"
      expect(card.name).toMatch(/^claude-agent/);
    });

    it("should use default description when no systemPrompt", async () => {
      const mockAgent = createMockAgent({ systemPrompt: undefined });

      const card = await getAgentCard({
        agent: mockAgent,
        card: { name: "Agent" },
      });

      expect(card.description).toBe(
        "A Claude Agent that can perform coding tasks"
      );
    });

    it("should use systemPrompt as description", async () => {
      const mockAgent = createMockAgent({
        systemPrompt: "You specialize in Python development",
      });

      const card = await getAgentCard({
        agent: mockAgent,
        card: { name: "Agent" },
      });

      expect(card.description).toBe("You specialize in Python development");
    });

    it("should create skills from tools array", async () => {
      const mockAgent = createMockAgent({
        tools: ["read_file", "write_file", "execute_command"],
      });

      const card = await getAgentCard({
        agent: mockAgent,
        card: { name: "Tool Agent" },
      });

      expect(card.skills).toHaveLength(3);
      expect(card.skills[0]).toMatchObject({
        name: "read_file",
        description: "A tool that can be used to read_file",
        tags: ["tool"],
      });
    });

    it("should create default code-execution skill when no tools provided", async () => {
      const mockAgent = createMockAgent({ tools: undefined });

      const card = await getAgentCard({
        agent: mockAgent,
        card: { name: "Agent" },
      });

      expect(card.skills).toHaveLength(1);
      expect(card.skills[0]).toEqual({
        id: "code-execution",
        name: "Code Execution",
        description: "Execute and modify code files",
        tags: ["coding", "files"],
      });
    });

    it("should handle agent with no options", async () => {
      const card = await getAgentCard({
        agent: undefined,
        card: { name: "Minimal Agent" },
      });

      expect(card.name).toBe("Minimal Agent");
      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].id).toBe("code-execution");
    });
  });

  describe("extractA2AMessage", () => {
    it("should extract user message with text content", () => {
      const sdkMessage: SDKMessage = {
        type: "user",
        message: {
          role: "user",
          content: "Hello, Claude!",
        },
      } as SDKMessage;

      const message = extractA2AMessage("task-1", "ctx-1", sdkMessage);

      expect(message.role).toBe("user");
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({
        kind: "text",
        text: "Hello, Claude!",
      });
    });

    it("should extract assistant message with text content", () => {
      const sdkMessage: SDKMessage = {
        type: "assistant",
        uuid: "uuid-123",
        session_id: "session-123",
        parent_tool_use_id: "tool-123",
        message: {
          type: "message",
          role: "assistant",
          content: "Hello! How can I help?",
        },
      } as unknown as SDKMessage;

      const message = extractA2AMessage("task-1", "ctx-1", sdkMessage);

      expect(message.role).toBe("agent");
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({
        kind: "text",
        text: "Hello! How can I help?",
      });
    });

    it("should handle content blocks array", () => {
      const sdkMessage: SDKMessage = {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" },
          ],
        },
      } as SDKMessage;

      const message = extractA2AMessage("task-1", "ctx-1", sdkMessage);

      expect(message.parts).toHaveLength(2);
      expect(message.parts[0]).toEqual({ kind: "text", text: "First part" });
      expect(message.parts[1]).toEqual({ kind: "text", text: "Second part" });
    });

    it("should handle thinking blocks", () => {
      const sdkMessage: SDKMessage = {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Let me think about this..." },
          ],
        },
      } as SDKMessage;

      const message = extractA2AMessage("task-1", "ctx-1", sdkMessage);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({
        kind: "text",
        text: "Let me think about this...",
      });
    });

    it("should handle other message types as data parts", () => {
      const sdkMessage: SDKMessage = {
        type: "tool_result",
        id: "tool-123",
        result: { output: "success" },
      } as unknown as SDKMessage;

      const message = extractA2AMessage("task-1", "ctx-1", sdkMessage);

      expect(message.parts).toHaveLength(1);
      expect(message.parts[0].kind).toBe("data");
    });

    it("should include taskId and contextId in message", () => {
      const sdkMessage: SDKMessage = {
        type: "user",
        message: { role: "user", content: "test" },
      } as SDKMessage;

      const message = extractA2AMessage("my-task", "my-context", sdkMessage);

      expect(message.taskId).toBe("my-task");
      expect(message.contextId).toBe("my-context");
    });
  });
});
