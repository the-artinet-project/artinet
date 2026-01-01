import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { requestImplementation } from "../../src/routes/request/implementation/request.js";
import { FetchAgent } from "../../src/routes/request/interceptors/fetch-agent.js";
import { GetAgents } from "../../src/routes/request/interceptors/get-agents.js";
import { invokeAgent } from "../../src/routes/request/implementation/invoke.js";
import { loadAgent } from "../../src/routes/request/implementation/load.js";
import { testInvoke } from "../../src/routes/request/implementation/test-invoke.js";
import {
  RequestAgentRoute,
  TestAgentRoute,
} from "../../src/routes/request/types/definitions.js";
import * as sdk from "@artinet/sdk";
import * as armada from "@artinet/armada";
import {
  createMockContext,
  createValidAgentConfig,
  createMockAgent,
} from "../mock.js";
// sdk.applyDefaults();
describe("Request Route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requestImplementation", () => {
    it("should throw error when target is not set", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const context = createMockContext({ target: undefined });

      await expect(
        requestImplementation(request, context)
      ).rejects.toThrowError(
        sdk.INTERNAL_ERROR({
          data: {
            message: /Agent test-agent-id not found: {"error":"Unknown error"}/,
          },
          method: request.method,
        })
      );
    });

    it("should throw error when agent fails to load", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const context = createMockContext({
        target: createValidAgentConfig(),
        load: jest.fn(() => Promise.resolve(undefined)),
      });

      // The implementation throws INTERNAL_ERROR which has message "Internal error"
      await expect(
        requestImplementation(request, context)
      ).rejects.toThrowError(
        sdk.INTERNAL_ERROR({
          data: {
            message: /Agent test-agent-id failed to load/,
          },
        })
      );
    });

    it("should throw error when invoke returns null", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const context = createMockContext({
        target: createValidAgentConfig(),
        invoke: jest.fn(() => Promise.resolve(null)),
      });

      // The implementation throws INTERNAL_ERROR which has message "Internal error"
      await expect(
        requestImplementation(request, context)
      ).rejects.toThrowError(
        sdk.INTERNAL_ERROR({
          data: {
            message: /Agent test-agent-id failed to invoke/,
          },
        })
      );
    });

    it("should successfully invoke agent and return response", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const expectedResponse: RequestAgentRoute["response"] = {
        type: "success",
        result: {
          kind: "task",
          id: "task-1",
          contextId: "context-1",
          status: { state: "completed" },
          artifacts: [],
          history: [],
        },
      };

      const context = createMockContext({
        target: createValidAgentConfig(),
        invoke: jest.fn(() => Promise.resolve(expectedResponse)),
      });

      const result = await requestImplementation(request, context);

      expect(result).toEqual(expectedResponse);
      expect(context.load).toHaveBeenCalled();
      expect(context.invoke).toHaveBeenCalled();
    });
  });

  describe("FetchAgent interceptor", () => {
    it("should not trigger when context has target", async () => {
      const context = createMockContext({ target: createValidAgentConfig() });
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: null,
      };
      await expect(
        armada.executeTrigger(FetchAgent.trigger, { request, context })
      ).resolves.toBe(false);
    });

    it("should trigger when context has no target", async () => {
      const context = createMockContext({ target: undefined });
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: null,
      };
      await expect(
        armada.executeTrigger(FetchAgent.trigger, { request, context })
      ).resolves.toBe(true);
    });

    it("should be in REQUEST phase", () => {
      expect(FetchAgent.phase).toBe(armada.Phase.REQUEST);
    });

    it("should throw error when agent is not found after fetch", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const context = createMockContext();

      // The FetchAgent will try to find the agent and fail since store is empty
      await expect(FetchAgent.action({ request, context })).rejects.toThrow();
    });
  });

  describe("GetAgents interceptor", () => {
    it("should not trigger when target is undefined", () => {
      const context = createMockContext({ target: undefined });
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: null,
      };

      expect(
        armada.executeTrigger(GetAgents.trigger, {
          request,
          context,
        })
      ).resolves.toBe(false);
    });

    it("should not trigger when agentIds is empty", () => {
      const context = createMockContext({
        target: createValidAgentConfig({ agentIds: [] }),
      });
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: null,
      };

      expect(
        armada.executeTrigger(GetAgents.trigger, {
          request,
          context,
        })
      ).resolves.toBe(false);
    });

    it("should trigger when target has agentIds", () => {
      const context = createMockContext({
        target: createValidAgentConfig({ agentIds: ["agent-1", "agent-2"] }),
      });
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: null,
      };

      expect(
        armada.executeTrigger(GetAgents.trigger, {
          request,
          context,
        })
      ).resolves.toBe(true);
    });

    it("should be in REQUEST phase", () => {
      expect(GetAgents.phase).toBe(armada.Phase.REQUEST);
    });

    it("should return request after processing empty agentIds", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: null,
      };

      const context = createMockContext({
        target: createValidAgentConfig({ agentIds: [] }),
      });

      const result = await GetAgents.action({ request, context });

      expect(result).toBe(request);
    });
  });

  describe("invokeAgent", () => {
    it("should handle message/send method", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const result = await invokeAgent(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { result: unknown })?.result).toBeDefined();
      expect(mockAgent.sendMessage).toHaveBeenCalled();
    });

    it("should handle message/stream method", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "message/stream",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const result = await invokeAgent(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { stream: unknown })?.stream).toBeDefined();
      expect(mockAgent.streamMessage).toHaveBeenCalled();
    });

    it("should handle task/get method", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "task/get",
        params: {
          id: "task-1",
        } as any,
      };

      const result = await invokeAgent(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { result: unknown })?.result).toBeDefined();
      expect(mockAgent.getTask).toHaveBeenCalled();
    });

    it("should handle task/cancel method", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "task/cancel",
        params: {
          id: "task-1",
        } as any,
      };

      const result = await invokeAgent(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { result: unknown })?.result).toBeDefined();
      expect(mockAgent.cancelTask).toHaveBeenCalled();
    });

    it("should handle agentcard/get method", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "agentcard/get",
        params: null,
      };

      const result = await invokeAgent(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { result: unknown })?.result).toBeDefined();
      expect(mockAgent.getAgentCard).toHaveBeenCalled();
    });

    it("should throw METHOD_NOT_FOUND for unknown methods", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "unknown/method",
        params: null,
      };

      await expect(invokeAgent(request, mockAgent)).rejects.toThrow(
        /Method not found/
      );
    });

    it("should throw INVALID_PARAMS when params validation fails", async () => {
      const mockAgent = createMockAgent();
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: "invalid-params" as any, // Invalid params type
      };

      await expect(invokeAgent(request, mockAgent)).rejects.toThrow();
    });
  });

  describe("RequestAgent integration", () => {
    it("should use requestImplementation as default implementation", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const agentConfig = createValidAgentConfig();
      const expectedResponse: RequestAgentRoute["response"] = {
        type: "success",
        result: {
          kind: "task",
          id: "task-1",
          contextId: "context-1",
          status: { state: "completed" },
          artifacts: [],
          history: [],
        },
      };

      const context = createMockContext({
        target: agentConfig,
        invoke: jest.fn(() => Promise.resolve(expectedResponse)),
      });

      // Call requestImplementation directly
      const result = await requestImplementation(request, context);

      expect(result).toEqual(expectedResponse);
      expect(context.load).toHaveBeenCalled();
      expect(context.invoke).toHaveBeenCalled();
    });
  });

  describe("loadAgent", () => {
    it("should throw error when context is undefined", async () => {
      const config = createValidAgentConfig();

      await expect(loadAgent(config, undefined)).rejects.toThrowError(
        sdk.INTERNAL_ERROR({
          message: "Context not found",
        })
      );
    });

    it("should throw error when agentIds are required but agents not loaded", async () => {
      const config = createValidAgentConfig({
        agentIds: ["agent-1", "agent-2"],
      });

      const context = createMockContext({
        agents: undefined,
      });

      await expect(loadAgent(config, context)).rejects.toThrowError(
        sdk.INTERNAL_ERROR({
          message: "Agents not found: agent-1, agent-2",
        })
      );
    });

    it("should create agent with orc8 when config is valid", async () => {
      const config = createValidAgentConfig();
      const context = createMockContext();

      const result = await loadAgent(config, context);
      expect(result).toBeDefined();
    });

    it("should add agents from context to orc8", async () => {
      const mockAgent = createMockAgent("sub-agent");
      const config = createValidAgentConfig();
      const context = createMockContext({
        agents: {
          "sub-agent": mockAgent,
        },
      });

      const result = await loadAgent(config, context);

      expect(result).toBeDefined();
    });

    it("should load tools from context to orc8", async () => {
      const config = createValidAgentConfig({
        services: [
          {
            type: "mcp",
            uri: "everything-server",
            info: {
              uri: "everything-server",
              implementation: {
                version: "0.0.1",
                name: "everything",
              },
            },
            arguments: {
              command: "npx",
              args: [
                "-y",
                "@modelcontextprotocol/server-everything@2025.11.25",
              ],
            },
          },
        ],
      });
      const context = createMockContext();
      const result = await loadAgent(config, context);
      await (result as sdk.A2A.Service).stop();
    });

    it("should use default model when modelId is not provided", async () => {
      const config = createValidAgentConfig({
        modelId: undefined,
      });
      const context = createMockContext();
      const result = await loadAgent(config, context);
      expect(result).toBeDefined();
      expect(result?.agentCard.name).toBe(config.name);
    });
  });

  describe("testInvoke", () => {
    // Helper to create a valid test request with required config field
    const createTestRequest = (
      tests: Array<{
        message: {
          messageId: string;
          kind: string;
          role: string;
          parts: Array<{ kind: string; text: string }>;
        };
      }>,
      overrides: Record<string, unknown> = {}
    ) =>
      ({
        method: "message/send",
        params: {
          config: createValidAgentConfig(),
          tests,
        },
        ...overrides,
      } as unknown as TestAgentRoute["request"]);

    it("should throw error for A2AClient agents", async () => {
      const mockClient = new sdk.A2AClient("http://localhost:3000");
      const request = createTestRequest([
        {
          message: {
            messageId: "test-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Test message" }],
          },
        },
      ]);

      await expect(testInvoke(request, mockClient)).rejects.toThrowError(
        sdk.INVALID_REQUEST({
          message: "Test agent requests are not supported for A2AClients",
          id: request.id,
          agentId: request.agentId,
        })
      );
    });

    it("should throw error when no tests provided", async () => {
      const mockAgent = createMockAgent();
      const request = createTestRequest([]);

      await expect(testInvoke(request, mockAgent)).rejects.toThrowError(
        sdk.INVALID_PARAMS({
          message: "Invalid parameters for testing: no tests provided",
          id: request.id,
          agentId: request.agentId,
          tests: [],
        })
      );
    });

    it("should return stream response for valid test request", async () => {
      const mockAgent = createMockAgent();
      const request = createTestRequest([
        {
          message: {
            messageId: "test-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Test message" }],
          },
        },
      ]);

      const result = await testInvoke(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { stream: unknown })?.stream).toBeDefined();
    });

    it("should iterate through all tests in stream", async () => {
      const mockAgent = createMockAgent();
      const request = createTestRequest([
        {
          message: {
            messageId: "test-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "First test" }],
          },
        },
        {
          message: {
            messageId: "test-2",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Second test" }],
          },
        },
      ]);

      const result = await testInvoke(request, mockAgent);
      const streamResult = result as { stream: AsyncIterable<unknown> };

      expect(streamResult?.stream).toBeDefined();

      const updates: unknown[] = [];
      for await (const update of streamResult.stream) {
        updates.push(update);
      }
      expect(updates.length).toBeGreaterThan(0);
      expect(mockAgent.streamMessage).toHaveBeenCalledTimes(2);
    });

    it("should use agentId as fallback when id is not provided", async () => {
      const mockAgent = createMockAgent();
      const request = createTestRequest(
        [
          {
            message: {
              messageId: "test-1",
              kind: "message",
              role: "user",
              parts: [{ kind: "text", text: "Test" }],
            },
          },
        ],
        { agentId: "fallback-agent-id" }
      );

      const result = await testInvoke(request, mockAgent);

      expect(result).toBeDefined();
      expect((result as { stream: unknown })?.stream).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should propagate SDK errors correctly", async () => {
      const request: RequestAgentRoute["request"] = {
        method: "message/send",
        params: {
          message: {
            messageId: "msg-1",
            kind: "message",
            role: "user",
            parts: [{ kind: "text", text: "Hello" }],
          },
        },
      };

      const context = createMockContext({
        target: createValidAgentConfig(),
        load: jest.fn(() => {
          throw sdk.INTERNAL_ERROR({
            data: { message: "Custom error" },
          });
        }),
      });

      await expect(
        requestImplementation(request, context)
      ).rejects.toThrowError(
        sdk.INTERNAL_ERROR({
          data: { message: "Custom error" },
        })
      );
    });
  });
});
