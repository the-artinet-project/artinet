/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "@jest/globals";
import { API, Runtime } from "@artinet/types";
import openai from "openai";
import {
  openaiMessages,
  mcpFunction,
  a2aFunction,
  openaiTools,
  openaiToolMessage,
  artinetRequest,
  openaiRequest,
  artinetResponse,
} from "../src/api/openai-util.js";

// Helper to safely get function from tool (handles union type)
function getFunctionTool(tool: openai.ChatCompletionTool) {
  if (tool.type === "function") {
    return (tool as openai.ChatCompletionFunctionTool).function;
  }
  throw new Error("Expected function tool");
}

// Helper for valid input schema
const validInputSchema = {
  type: "object" as const,
  properties: {},
};

describe("OpenAI Util Tests", () => {
  describe("openaiMessages", () => {
    it("should convert user message", () => {
      const messages: API.Message[] = [{ role: "user", content: "Hello" }];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: "user", content: "Hello" });
    });

    it("should convert agent role to assistant", () => {
      const messages: API.Message[] = [{ role: "agent", content: "Hi there" }];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: "assistant", content: "Hi there" });
    });

    it("should convert assistant role to assistant", () => {
      const messages: API.Message[] = [
        { role: "assistant", content: "Hi there" },
      ];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: "assistant", content: "Hi there" });
    });

    it("should convert system message", () => {
      const messages: API.Message[] = [
        { role: "system", content: "You are helpful" },
      ];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: "system", content: "You are helpful" });
    });

    it("should handle multiple messages", () => {
      const messages: API.Message[] = [
        { role: "system", content: "Be helpful" },
        { role: "user", content: "Hello" },
        { role: "agent", content: "Hi!" },
      ];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe("system");
      expect(result[1].role).toBe("user");
      expect(result[2].role).toBe("assistant");
    });

    it("should filter out empty content", () => {
      const messages: API.Message[] = [
        { role: "user", content: "Hello" },
        { role: "agent", content: "" },
      ];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Hello");
    });

    it("should extract text from object content", () => {
      const messages: API.Message[] = [
        { role: "user", content: { text: "Hello from object" } as any },
      ];
      const result = openaiMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Hello from object");
    });
  });

  describe("mcpFunction", () => {
    it("should convert MCP tool info to OpenAI tools", () => {
      const toolInfo: Runtime.ToolInfo = {
        uri: "test-uri",
        implementation: { name: "test-server", version: "1.0.0" },
        serverCapabilities: {},
        tools: [
          {
            name: "echo",
            description: "Echoes input",
            inputSchema: {
              type: "object",
              properties: { message: { type: "string" } },
            },
          },
        ],
        resources: [],
        prompts: [],
      };

      const result = mcpFunction("abc123", toolInfo);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("function");
      expect(getFunctionTool(result[0]).name).toBe("mcp_-_abc123_-_echo");
      expect(getFunctionTool(result[0]).description).toBe("Echoes input");
    });

    it("should return empty array when no tools", () => {
      const toolInfo: Runtime.ToolInfo = {
        uri: "test-uri",
        implementation: { name: "test-server", version: "1.0.0" },
        serverCapabilities: {},
        tools: [],
        resources: [],
        prompts: [],
      };

      const result = mcpFunction("abc123", toolInfo);
      expect(result).toHaveLength(0);
    });

    it("should convert multiple tools", () => {
      const toolInfo: Runtime.ToolInfo = {
        uri: "test-uri",
        implementation: { name: "test-server", version: "1.0.0" },
        serverCapabilities: {},
        tools: [
          {
            name: "tool1",
            description: "First tool",
            inputSchema: validInputSchema,
          },
          {
            name: "tool2",
            description: "Second tool",
            inputSchema: validInputSchema,
          },
        ],
        resources: [],
        prompts: [],
      };

      const result = mcpFunction("xyz789", toolInfo);

      expect(result).toHaveLength(2);
      expect(getFunctionTool(result[0]).name).toBe("mcp_-_xyz789_-_tool1");
      expect(getFunctionTool(result[1]).name).toBe("mcp_-_xyz789_-_tool2");
    });
  });

  describe("a2aFunction", () => {
    // Helper for valid agent info
    const baseAgentInfo = {
      uri: "test-uri",
      protocolVersion: "1.0",
      version: "1.0.0",
      capabilities: {},
      defaultInputModes: [] as string[],
      defaultOutputModes: [] as string[],
    };

    it("should convert agent with skills to OpenAI tools", () => {
      const agentInfo: Runtime.AgentInfo = {
        ...baseAgentInfo,
        name: "TestAgent",
        description: "A test agent",
        url: "https://test.local",
        skills: [
          {
            id: "skill-1",
            name: "greet",
            description: "Greets the user",
            tags: ["greeting"],
            examples: ["Hello!", "Hi there!"],
          },
        ],
      };

      const result = a2aFunction("def456", agentInfo);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("function");
      expect(getFunctionTool(result[0]).name).toBe("a2a_-_def456_-_greet");
      expect(getFunctionTool(result[0]).description).toContain("TestAgent");
      expect(getFunctionTool(result[0]).description).toContain("greet");
    });

    it("should create default tool when agent has no skills", () => {
      const agentInfo: Runtime.AgentInfo = {
        ...baseAgentInfo,
        name: "SimpleAgent",
        description: "A simple agent",
        url: "https://simple.local",
        skills: [],
      };

      const result = a2aFunction("ghi789", agentInfo);

      expect(result).toHaveLength(1);
      expect(getFunctionTool(result[0]).name).toBe(
        "a2a_-_ghi789_-_SimpleAgent"
      );
      expect(getFunctionTool(result[0]).description).toContain("SimpleAgent");
    });

    it("should create default tool when skills is undefined", () => {
      const agentInfo = {
        ...baseAgentInfo,
        name: "NoSkillAgent",
        description: "An agent without skills",
        url: "https://noskill.local",
      } as Runtime.AgentInfo;

      const result = a2aFunction("jkl012", agentInfo);

      expect(result).toHaveLength(1);
      expect(getFunctionTool(result[0]).name).toContain("a2a_-_jkl012");
    });
  });

  describe("openaiTools", () => {
    it("should return empty tools and uriMap for empty services", () => {
      const result = openaiTools([]);
      expect(result.tools).toHaveLength(0);
      expect(result.uriMap.size).toBe(0);
    });

    it("should return empty for undefined services", () => {
      const result = openaiTools(undefined);
      expect(result.tools).toHaveLength(0);
    });

    it("should convert MCP services and create URI map", () => {
      const services: Runtime.Service[] = [
        {
          type: "mcp",
          uri: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          info: {
            uri: "test",
            implementation: { name: "test", version: "1.0.0" },
            serverCapabilities: {},
            tools: [
              {
                name: "echo",
                description: "Echo",
                inputSchema: validInputSchema,
              },
            ],
            resources: [],
            prompts: [],
          },
        },
      ];

      const result = openaiTools(services);

      expect(result.tools).toHaveLength(1);
      expect(result.uriMap.get("eeeeeeeeeeee")).toBe(
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      );
    });

    it("should convert A2A services", () => {
      const services: Runtime.Service[] = [
        {
          type: "a2a",
          uri: "11111111-2222-3333-4444-555555555555",
          url: "https://agent.local",
          info: {
            uri: "test",
            protocolVersion: "1.0",
            version: "1.0.0",
            capabilities: {},
            defaultInputModes: [],
            defaultOutputModes: [],
            name: "TestAgent",
            description: "Test",
            url: "https://agent.local",
            skills: [
              {
                id: "s1",
                name: "skill1",
                description: "Skill 1",
                tags: ["test"],
              },
            ],
          },
        },
      ];

      const result = openaiTools(services);

      expect(result.tools).toHaveLength(1);
      expect(result.uriMap.get("555555555555")).toBe(
        "11111111-2222-3333-4444-555555555555"
      );
    });
  });

  describe("openaiToolMessage", () => {
    it("should convert tool response with MCP content", () => {
      const response: Runtime.ToolResponse = {
        kind: "tool_response",
        id: "call-789",
        callerId: "caller-789",
        uri: "test-uri",
        type: "mcp",
        call: { name: "echo", arguments: {} },
        result: {
          content: [{ type: "text", text: "Hello from tool" }],
        },
      };

      const result = openaiToolMessage(response);

      expect(result.role).toBe("tool");
      expect(result.tool_call_id).toBe("call-789");
    });

    it("should convert agent response", () => {
      const response: Runtime.AgentResponse = {
        kind: "agent_response",
        id: "agent-call-123",
        callerId: "caller-123",
        uri: "agent-uri",
        type: "a2a",
        call: "hello",
        result: "Agent says hello",
      };

      const result = openaiToolMessage(response);

      expect(result.role).toBe("tool");
      expect(result.tool_call_id).toBe("agent-call-123");
      expect(result.content).toBe("Agent says hello");
    });

    it("should use callerId when id is missing", () => {
      const response: Runtime.ToolResponse = {
        kind: "tool_response",
        id: "caller-only",
        callerId: "caller-only",
        uri: "test-uri",
        type: "mcp",
        call: { name: "tool", arguments: {} },
        result: {
          content: [{ type: "text", text: "Result" }],
        },
      };

      const result = openaiToolMessage(response);
      expect(result.tool_call_id).toBe("caller-only");
    });
  });

  describe("artinetRequest", () => {
    it("should convert MCP function tool call", () => {
      const toolCall: openai.ChatCompletionMessageToolCall = {
        id: "call_abc123",
        type: "function",
        function: {
          name: "mcp_-_shortUri_-_echo",
          arguments: '{"message":"hello"}',
        },
      };
      const uriMap = new Map([["shortUri", "full-uuid-uri"]]);

      const result = artinetRequest("test-caller", toolCall, uriMap);

      expect(result.kind).toBe("tool_request");
      expect(result.uri).toBe("full-uuid-uri");
      expect((result as Runtime.ToolRequest).call?.name).toBe("echo");
    });

    it("should convert A2A function tool call", () => {
      const toolCall: openai.ChatCompletionMessageToolCall = {
        id: "call_def456",
        type: "function",
        function: {
          name: "a2a_-_agentUri_-_greet",
          arguments: '{"message":"hi there"}',
        },
      };
      const uriMap = new Map([["agentUri", "full-agent-uuid"]]);

      const result = artinetRequest("test-caller", toolCall, uriMap);

      expect(result.kind).toBe("agent_request");
      expect(result.uri).toBe("full-agent-uuid");
    });

    it("should use shortUri when not in map", () => {
      const toolCall: openai.ChatCompletionMessageToolCall = {
        id: "call_xyz",
        type: "function",
        function: {
          name: "mcp_-_unmapped_-_tool",
          arguments: "{}",
        },
      };
      const uriMap = new Map<string, string>();

      const result = artinetRequest("caller", toolCall, uriMap);

      expect(result.uri).toBe("unmapped");
    });
  });

  describe("openaiRequest", () => {
    it("should convert basic request", () => {
      const request: API.ConnectRequest = {
        identifier: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        preferredEndpoint: "auto",
      };

      const { params, uriMap } = openaiRequest(request);

      expect(params.model).toBe("gpt-4");
      expect(params.messages).toHaveLength(1);
      expect(params.stream).toBe(false);
      expect(uriMap.size).toBe(0);
    });

    it("should include tools from services", () => {
      const request: API.ConnectRequest = {
        identifier: "gpt-4",
        messages: [{ role: "user", content: "Use echo" }],
        preferredEndpoint: "auto",
        options: {
          tools: {
            services: [
              {
                type: "mcp",
                uri: "tool-uuid-here-12345",
                info: {
                  uri: "test",
                  implementation: { name: "test", version: "1.0.0" },
                  serverCapabilities: {},
                  tools: [
                    {
                      name: "echo",
                      description: "Echo",
                      inputSchema: validInputSchema,
                    },
                  ],
                  resources: [],
                  prompts: [],
                },
              },
            ],
          },
        },
      };

      const { params, uriMap } = openaiRequest(request);

      expect(params.tools).toBeDefined();
      expect(params.tools?.length).toBe(1);
      expect(uriMap.size).toBe(1);
    });

    it("should reconstruct assistant tool_calls when responses exist", () => {
      const request: API.ConnectRequest = {
        identifier: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        preferredEndpoint: "auto",
        options: {
          tools: {
            responses: [
              {
                kind: "tool_response",
                id: "call-123",
                uri: "test-uri",
                type: "mcp",
                call: { name: "echo", arguments: { msg: "hi" } },
                result: { content: [{ type: "text", text: "echoed" }] },
              },
            ],
          },
        },
      };

      const { params } = openaiRequest(request);

      // Should have: user message, assistant with tool_calls, tool response
      expect(params.messages.length).toBe(3);
      expect(params.messages[0].role).toBe("user");
      expect(params.messages[1].role).toBe("assistant");
      expect(params.messages[2].role).toBe("tool");

      // Check assistant message has tool_calls
      const assistantMsg = params.messages[1] as any;
      expect(assistantMsg.tool_calls).toBeDefined();
      expect(assistantMsg.tool_calls).toHaveLength(1);
    });
  });

  describe("artinetResponse", () => {
    it("should convert basic completion", () => {
      const completion: openai.ChatCompletion = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1700000000,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello!",
              refusal: null,
            },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
      };

      const result = artinetResponse(completion, new Map());

      expect(result.message?.content).toBe("Hello!");
      expect(result.timestamp).toBeDefined();
    });

    it("should convert completion with tool calls", () => {
      const completion: openai.ChatCompletion = {
        id: "chatcmpl-456",
        object: "chat.completion",
        created: 1700000000,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              refusal: null,
              tool_calls: [
                {
                  id: "call_abc",
                  type: "function",
                  function: {
                    name: "mcp_-_shortUri_-_echo",
                    arguments: '{"message":"test"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
            logprobs: null,
          },
        ],
      };
      const uriMap = new Map([["shortUri", "full-uri"]]);

      const result = artinetResponse(completion, uriMap);

      expect(result.options?.tools?.requests).toHaveLength(1);
      expect(result.options?.tools?.requests?.[0].uri).toBe("full-uri");
    });

    it("should separate MCP and A2A requests", () => {
      const completion: openai.ChatCompletion = {
        id: "chatcmpl-789",
        object: "chat.completion",
        created: 1700000000,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              refusal: null,
              tool_calls: [
                {
                  id: "call_mcp",
                  type: "function",
                  function: {
                    name: "mcp_-_toolUri_-_echo",
                    arguments: "{}",
                  },
                },
                {
                  id: "call_a2a",
                  type: "function",
                  function: {
                    name: "a2a_-_agentUri_-_greet",
                    arguments: '{"message":"hi"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
            logprobs: null,
          },
        ],
      };
      const uriMap = new Map([
        ["toolUri", "full-tool-uri"],
        ["agentUri", "full-agent-uri"],
      ]);

      const result = artinetResponse(completion, uriMap);

      expect(result.options?.tools?.requests).toHaveLength(1);
      expect(result.options?.agents?.requests).toHaveLength(1);
      expect(result.options?.tools?.requests?.[0].kind).toBe("tool_request");
      expect(result.options?.agents?.requests?.[0].kind).toBe("agent_request");
    });

    it("should handle empty content", () => {
      const completion: openai.ChatCompletion = {
        id: "chatcmpl-empty",
        object: "chat.completion",
        created: 1700000000,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              refusal: null,
            },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
      };

      const result = artinetResponse(completion, new Map());

      expect(result.message?.content).toBeNull();
    });
  });
});
