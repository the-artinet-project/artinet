import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { Hono, Context, Next } from "hono";

import { fleet, Settings } from "../../src/server/hono/server.js";
import * as agentRequest from "../../src/server/hono/agent-request.js";
import * as deployRequest from "../../src/server/hono/deploy-request.js";
import * as testRequest from "../../src/server/hono/test-request.js";
import {
  toJSONRPCResponse,
  handleJSONRPCResponse,
} from "../../src/server/hono/rpc.js";
import { generateRequestId } from "../../src/server/hono/utils.js";
import { ResultOrError } from "../../src/types.js";
import {
  RequestAgentRoute,
  TestAgentRoute,
} from "../../src/routes/request/types/definitions.js";
import { CreateAgentRoute } from "../../src/routes/create/index.js";
import {
  createMockContext,
  createValidAgentConfig,
  MockStore,
} from "../mock.js";
import { loadAgent, invokeAgent } from "../../src/routes/request/index.js";
import { InMemoryStore } from "../../src/storage/in-memory.js";
import { RequestAgent } from "../../src/routes/request/index.js";
import { CreateAgent } from "../../src/routes/create/index.js";
import { describe as des6, applyDefaults } from "@artinet/sdk";

// applyDefaults();
/**
 * Creates a mock Hono Context for testing
 */
const createMockHonoContext = (
  overrides: {
    path?: string;
    body?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): {
  ctx: Context;
  getJson: () => unknown;
  getStatus: () => number;
  getHeaders: () => Record<string, string>;
} => {
  let jsonResponse: unknown = null;
  let statusCode = 200;
  let responseHeaders: Record<string, string> = {};

  const ctx = {
    req: {
      path: overrides.path ?? "/test",
      json: jest.fn(() => Promise.resolve(overrides.body ?? {})),
      text: jest.fn(() =>
        Promise.resolve(JSON.stringify(overrides.body ?? {}))
      ),
      param: jest.fn((name: string) => overrides.params?.[name]),
      header: jest.fn((name: string) => overrides.headers?.[name]),
    },
    json: jest.fn((data: unknown) => {
      jsonResponse = data;
      return new Response(JSON.stringify(data));
    }),
    status: jest.fn((code: number) => {
      statusCode = code;
    }),
    header: jest.fn((name: string, value: string) => {
      responseHeaders[name] = value;
    }),
    res: null as unknown,
  } as unknown as Context;

  return {
    ctx,
    getJson: () => jsonResponse,
    getStatus: () => statusCode,
    getHeaders: () => responseHeaders,
  };
};

describe("Hono Server", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("utils.ts - generateRequestId", () => {
    it("should return context requestId if present", () => {
      const context = { requestId: "context-request-id" };

      const result = generateRequestId(context, "fallback-id");

      expect(result).toBe("context-request-id");
    });

    it("should return provided reqId if context requestId is missing", () => {
      const context = {};

      const result = generateRequestId(context, "provided-request-id");

      expect(result).toBe("provided-request-id");
    });

    it("should generate UUID if all sources are missing", () => {
      const context = {};

      const result = generateRequestId(context, undefined);

      // UUID v4 format
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe("rpc.ts - toJSONRPCResponse", () => {
    it("should return success response for success type", () => {
      const resultOrError: ResultOrError = {
        type: "success",
        result: { data: "test" },
      };

      const response = toJSONRPCResponse("req-1", resultOrError);

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "req-1",
        result: { data: "test" },
      });
    });

    it("should return error response for error type", () => {
      const resultOrError: ResultOrError = {
        type: "error",
        error: { code: -32600, message: "Invalid Request" },
      };

      const response = toJSONRPCResponse("req-1", resultOrError);

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "req-1",
        error: { code: -32600, message: "Invalid Request" },
      });
    });

    it("should throw error for stream type", () => {
      const resultOrError: ResultOrError = {
        type: "stream",
        stream: (async function* () {
          yield "data";
        })(),
      };

      expect(() => toJSONRPCResponse("req-1", resultOrError)).toThrow(
        "Invalid response type"
      );
    });
  });

  describe("rpc.ts - handleJSONRPCResponse", () => {
    it("should return plain JSON for agentcard/get success", async () => {
      const { ctx } = createMockHonoContext();
      const response: ResultOrError = {
        type: "success",
        result: { name: "test-agent" },
      };

      // handleJSONRPCResponse throws for success after setting json, catch it
      try {
        await handleJSONRPCResponse(ctx, "req-1", "agentcard/get", response);
      } catch (e) {
        // Expected to throw "Unknown response type" after processing
      }

      expect(ctx.json).toHaveBeenCalledWith({ name: "test-agent" });
    });

    it("should return JSON-RPC response for non-agentcard success", async () => {
      const { ctx } = createMockHonoContext();
      const response: ResultOrError = {
        type: "success",
        result: { kind: "task", id: "task-1" },
      };

      try {
        await handleJSONRPCResponse(ctx, "req-1", "message/send", response);
      } catch (e) {
        // Expected to throw after processing
      }

      expect(ctx.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: "req-1",
        result: { kind: "task", id: "task-1" },
      });
    });

    it("should return JSON-RPC error response for error type", async () => {
      const { ctx } = createMockHonoContext();
      const response: ResultOrError = {
        type: "error",
        error: { code: -32600, message: "Invalid Request" },
      };

      try {
        await handleJSONRPCResponse(ctx, "req-1", "message/send", response);
      } catch (e) {
        // Expected to throw after processing
      }

      expect(ctx.status).toHaveBeenCalledWith(500);
      expect(ctx.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: "req-1",
        error: { code: -32600, message: "Invalid Request" },
      });
    });

    it("should throw INTERNAL_ERROR for unknown response type", async () => {
      const { ctx } = createMockHonoContext();
      const response = { type: "unknown" } as unknown as ResultOrError;

      await expect(
        handleJSONRPCResponse(ctx, "req-1", "message/send", response)
      ).rejects.toThrow(/Internal error/);
    });
  });

  describe("agent-request.ts", () => {
    describe("handle", () => {
      it("should transform agent-card.json path to agentcard/get request", async () => {
        const { ctx } = createMockHonoContext({
          path: "/agent/123/.well-known/agent-card.json",
          body: {},
        });
        const next = jest.fn() as unknown as Next;
        const mockHandler = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test-agent" },
          })
        ) as unknown as RequestAgentRoute["implementation"];

        const context = createMockContext();

        try {
          await agentRequest.handle(ctx, next, context, mockHandler);
        } catch (e) {
          // handleJSONRPCResponse throws after processing
        }

        expect(mockHandler).toHaveBeenCalledWith(
          expect.objectContaining({ method: "agentcard/get" }),
          expect.any(Object)
        );
        expect(ctx.json).toHaveBeenCalledWith({ name: "test-agent" });
      });

      it("should transform agent.json path to agentcard/get request", async () => {
        const { ctx } = createMockHonoContext({
          path: "/agent/123/.well-known/agent.json",
          body: {},
        });
        const next = jest.fn() as unknown as Next;
        const mockHandler = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test-agent", version: "1.0.0" },
          })
        ) as unknown as RequestAgentRoute["implementation"];

        const context = createMockContext();

        try {
          await agentRequest.handle(ctx, next, context, mockHandler);
        } catch (e) {
          // handleJSONRPCResponse throws after processing
        }

        expect(mockHandler).toHaveBeenCalledWith(
          expect.objectContaining({ method: "agentcard/get" }),
          expect.any(Object)
        );
        expect(ctx.json).toHaveBeenCalledWith({
          name: "test-agent",
          version: "1.0.0",
        });
      });

      it("should skip schema validation for agent-card.json paths", async () => {
        const { ctx } = createMockHonoContext({
          path: "/agent/123/agent-card.json",
          body: { invalid: "data", not: "jsonrpc" },
        });
        const next = jest.fn() as unknown as Next;
        const mockHandler = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test-agent" },
          })
        ) as unknown as RequestAgentRoute["implementation"];

        const context = createMockContext();

        // Should not throw since validation is skipped for agent-card.json paths
        try {
          await agentRequest.handle(ctx, next, context, mockHandler);
        } catch (e) {
          // handleJSONRPCResponse throws after processing
        }

        expect(mockHandler).toHaveBeenCalled();
      });

      it("should parse JSON-RPC request body", async () => {
        const { ctx } = createMockHonoContext({
          path: "/agent/123",
          body: {
            jsonrpc: "2.0",
            id: "req-1",
            method: "message/send",
            params: {
              message: {
                messageId: "msg-1",
                kind: "message",
                role: "user",
                parts: [{ kind: "text", text: "Hello" }],
              },
            },
          },
        });
        const next = jest.fn() as unknown as Next;
        const mockHandler = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { kind: "task", id: "task-1" },
          })
        ) as unknown as RequestAgentRoute["implementation"];

        const context = createMockContext();

        try {
          await agentRequest.handle(ctx, next, context, mockHandler);
        } catch (e) {
          // handleJSONRPCResponse throws after processing
        }

        expect(mockHandler).toHaveBeenCalledWith(
          expect.objectContaining({ method: "message/send" }),
          expect.any(Object)
        );
        expect(ctx.json).toHaveBeenCalled();
      });
    });

    describe("factory", () => {
      it("should create a handler with the provided implementation", async () => {
        const mockImpl = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test" },
          })
        ) as unknown as RequestAgentRoute["implementation"];

        const handler = agentRequest.factory(mockImpl);

        expect(typeof handler).toBe("function");
      });
    });

    describe("request", () => {
      it("should throw error when agentId is missing", async () => {
        const { ctx } = createMockHonoContext({
          params: {},
          path: "/agent/",
        });
        const next = jest.fn() as unknown as Next;

        await expect(
          agentRequest.request({
            ctx,
            next,
            context: createMockContext(),
            handler: jest.fn() as unknown as agentRequest.handler,
            user: jest.fn(() => Promise.resolve("test-user")),
          })
        ).rejects.toThrow("Request payload validation error");
      });

      it("should call handler with agentId from params", async () => {
        const mockHandler = jest.fn() as unknown as agentRequest.handler;
        const { ctx } = createMockHonoContext({
          params: { agentId: "my-agent" },
          path: "/agent/my-agent",
          body: {},
        });
        const next = jest.fn() as unknown as Next;

        await agentRequest.request({
          ctx,
          next,
          context: createMockContext(),
          handler: mockHandler,
          user: jest.fn(() => Promise.resolve("test-user")),
        });

        expect(mockHandler).toHaveBeenCalledWith(
          ctx,
          next,
          expect.objectContaining({ agentId: "my-agent" })
        );
      });

      it("should use deploymentId param as agentId", async () => {
        const mockHandler = jest.fn() as unknown as agentRequest.handler;
        const { ctx } = createMockHonoContext({
          params: { agentId: "deployment-123" },
          path: "/deployment/deployment-123",
          body: {},
        });
        const next = jest.fn() as unknown as Next;

        await agentRequest.request({
          ctx,
          next,
          context: createMockContext(),
          handler: mockHandler,
          user: jest.fn(() => Promise.resolve("test-user")),
        });

        expect(mockHandler).toHaveBeenCalledWith(
          ctx,
          next,
          expect.objectContaining({ agentId: "deployment-123" })
        );
      });
    });
  });

  describe("deploy-request.ts", () => {
    describe("handle", () => {
      it("should parse request body and call deploy", async () => {
        const { ctx } = createMockHonoContext({
          body: {
            config: {
              name: "my-agent",
              description: "A new agent",
              modelId: "gpt-4",
              instructions: "Be helpful",
              uri: "test-uri",
              skills: [],
              version: "1.0.0",
              toolIds: [],
              groupIds: [],
              services: [],
              capabilities: {},
              defaultInputModes: ["text"],
              defaultOutputModes: ["text"],
            },
          },
        });
        const next = jest.fn() as unknown as Next;
        const mockDeploy = jest.fn(() =>
          Promise.resolve({ agentId: "new-agent-123" })
        ) as unknown as CreateAgentRoute["implementation"];

        const context: CreateAgentRoute["context"] = {
          storage: new MockStore(),
          baseUrl: "http://localhost:3000",
          agentPath: "/agent",
        };

        await deployRequest.handle(ctx, next, context, mockDeploy);

        expect(mockDeploy).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({ name: "my-agent" }),
          }),
          expect.any(Object)
        );
        expect(ctx.json).toHaveBeenCalledWith({ agentId: "new-agent-123" });
      });
    });

    describe("factory", () => {
      it("should create a handler with the provided implementation", () => {
        const mockImpl = jest.fn(() =>
          Promise.resolve({ agentId: "test" })
        ) as unknown as CreateAgentRoute["implementation"];

        const handler = deployRequest.factory(mockImpl);

        expect(typeof handler).toBe("function");
      });
    });

    describe("request", () => {
      it("should add requestId to context from header", async () => {
        const mockHandler = jest.fn() as unknown as deployRequest.handler;
        const { ctx } = createMockHonoContext({
          body: {},
          headers: { "x-request-id": "deploy-req-123" },
        });
        const next = jest.fn() as unknown as Next;

        const context: CreateAgentRoute["context"] = {
          storage: new MockStore(),
          baseUrl: "http://localhost:3000",
          agentPath: "/agent",
        };

        await deployRequest.request({
          ctx,
          next,
          context,
          handler: mockHandler,
          user: jest.fn(() => Promise.resolve("test-user")),
        });

        expect(mockHandler).toHaveBeenCalledWith(
          ctx,
          next,
          expect.objectContaining({ requestId: "deploy-req-123" })
        );
      });
    });
  });

  describe("test-request.ts", () => {
    describe("handle", () => {
      it("should parse test request and call test handler", async () => {
        const { ctx } = createMockHonoContext({
          body: {
            jsonrpc: "2.0",
            id: "test-req-1",
            config: createValidAgentConfig(),
            tests: [
              {
                message: {
                  messageId: "msg-1",
                  kind: "message",
                  role: "user",
                  parts: [{ kind: "text", text: "Hello, agent!" }],
                },
              },
            ],
          },
        });
        const next = jest.fn() as unknown as Next;
        const mockTest = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { kind: "task" as const, id: "test-task-1" },
          })
        ) as unknown as TestAgentRoute["implementation"];

        const context: TestAgentRoute["context"] = {
          agentId: "test-agent-id",
          baseUrl: "http://localhost:3000",
          agentPath: "/agent",
          storage: new MockStore(),
          load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
          invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
        };

        try {
          await testRequest.handle(ctx, next, context, mockTest);
        } catch (e) {
          // handleJSONRPCResponse throws after processing
        }

        expect(mockTest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "test/invoke" }),
          expect.objectContaining({ target: expect.any(Object) })
        );
      });
    });

    describe("factory", () => {
      it("should create a handler with the provided implementation", () => {
        const mockImpl = jest.fn(() =>
          Promise.resolve({ type: "success" as const, result: {} })
        ) as unknown as TestAgentRoute["implementation"];

        const handler = testRequest.factory(mockImpl);

        expect(typeof handler).toBe("function");
      });
    });

    describe("request", () => {
      it("should generate unique agentId for test", async () => {
        const mockHandler = jest.fn() as unknown as testRequest.handler;
        const { ctx } = createMockHonoContext({
          body: {},
        });
        const next = jest.fn() as unknown as Next;

        const context: Omit<TestAgentRoute["context"], "agentId"> = {
          baseUrl: "http://localhost:3000",
          agentPath: "/agent",
          storage: new MockStore(),
          load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
          invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
        };

        await testRequest.request({
          ctx,
          next,
          context,
          handler: mockHandler,
          user: jest.fn(() => Promise.resolve("test-user")),
        });

        expect(mockHandler).toHaveBeenCalledWith(
          ctx,
          next,
          expect.objectContaining({
            agentId: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            ),
          })
        );
      });

      // TODO: Add test for testId collisions
    });
  });

  describe("server.ts - fleet", () => {
    it("should create a Hono app with default routes", () => {
      const settings: Partial<Settings> = {
        get: jest.fn() as unknown as RequestAgentRoute["implementation"],
        set: jest.fn() as unknown as CreateAgentRoute["implementation"],
        storage: new MockStore(),
        load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
        invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
      };

      const { app } = fleet(settings, {});

      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe("function");
    });

    it("should use provided Hono app", () => {
      const existingApp = new Hono();

      const settings: Partial<Settings> = {
        get: jest.fn() as unknown as RequestAgentRoute["implementation"],
        set: jest.fn() as unknown as CreateAgentRoute["implementation"],
        storage: new MockStore(),
        load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
        invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
      };

      const { app } = fleet(settings, { app: existingApp });

      expect(app).toBe(existingApp);
    });

    it("should apply auth middleware when provided", () => {
      const mockAuth = jest.fn(async (ctx: Context, next: Next) => {
        await next();
      });

      const settings: Partial<Settings> = {
        get: jest.fn() as unknown as RequestAgentRoute["implementation"],
        set: jest.fn() as unknown as CreateAgentRoute["implementation"],
        auth: mockAuth,
        storage: new MockStore(),
        load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
        invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
      };

      const { app } = fleet(settings, { authOnRetrieve: true });

      expect(app).toBeDefined();
    });

    it("should disable testing route when enableTesting is false", () => {
      const settings: Partial<Settings> = {
        get: jest.fn() as unknown as RequestAgentRoute["implementation"],
        set: jest.fn() as unknown as CreateAgentRoute["implementation"],
        test: jest.fn() as unknown as TestAgentRoute["implementation"],
        storage: new MockStore(),
        load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
        invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
      };

      const { app } = fleet(settings, { enableTesting: false });

      expect(app).toBeDefined();
    });

    it("should use custom paths when provided", () => {
      const settings: Partial<Settings> = {
        basePath: "/api/v1",
        agentPath: "/custom-agents",
        deploymentPath: "/custom-deploy",
        testPath: "/custom-test",
        get: jest.fn() as unknown as RequestAgentRoute["implementation"],
        set: jest.fn() as unknown as CreateAgentRoute["implementation"],
        storage: new MockStore(),
        load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
        invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
      };

      const { app } = fleet(settings, {});

      expect(app).toBeDefined();
    });
  });

  describe("Integration tests", () => {
    let mockStorage: MockStore<unknown>;

    beforeEach(() => {
      mockStorage = new MockStore();
    });

    it("should return 404 for unknown routes", async () => {
      const mockGet = jest.fn(() =>
        Promise.resolve({
          type: "success" as const,
          result: { name: "test" },
        })
      ) as unknown as RequestAgentRoute["implementation"];
      const mockSet = jest.fn(() =>
        Promise.resolve({ agentId: "new-agent" })
      ) as unknown as CreateAgentRoute["implementation"];

      const { app } = fleet(
        {
          get: mockGet,
          set: mockSet,
          storage: mockStorage,
          load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
          invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
        },
        {}
      );

      const res = await app.request("/unknown-route");

      expect(res.status).toBe(404);
    });

    it("should handle deployment requests at deploymentPath", async () => {
      const mockSet = jest.fn(() =>
        Promise.resolve({ agentId: "deployed-agent-123" })
      ) as unknown as CreateAgentRoute["implementation"];

      const { app } = fleet(
        {
          get: jest.fn() as unknown as RequestAgentRoute["implementation"],
          set: mockSet,
          userId: "test-user-id",
          storage: mockStorage,
          load: jest.fn() as unknown as TestAgentRoute["context"]["load"],
          invoke: jest.fn() as unknown as TestAgentRoute["context"]["invoke"],
        },
        {}
      );

      const res = await app.request("/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            name: "my-agent",
            description: "Test agent",
            modelId: "gpt-4",
            instructions: "Be helpful",
            uri: "test-uri",
            skills: [],
            version: "1.0.0",
            toolIds: [],
            groupIds: [],
            services: [],
            capabilities: {},
            defaultInputModes: ["text"],
            defaultOutputModes: ["text"],
          },
        }),
      });
      expect(mockSet).toHaveBeenCalled();
      const body = await res.json();
      expect(body).toEqual({ agentId: "deployed-agent-123" });
    });

    it("should deploy an agent and retrieve its card", async () => {
      const storage = new InMemoryStore();

      const { app } = fleet(
        {
          get: RequestAgent,
          set: CreateAgent,
          baseUrl: "https://silly.com",
          agentPath: "/funny",
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      // Deploy an agent
      const deployRes = await app.request("/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            name: "integration-test-agent",
            description: "An agent for integration testing",
            modelId: "gpt-4",
            instructions: "You are a helpful assistant",
            uri: "integration-test",
            skills: [],
            version: "1.0.0",
            toolIds: [],
            groupIds: [],
            services: [],
            capabilities: { streaming: false },
            defaultInputModes: ["text"],
            defaultOutputModes: ["text"],
          },
        }),
      });
      const deployBody = await deployRes.json();
      const { agentId } = deployBody as { agentId: string };
      expect(agentId).toBeDefined();
      expect(deployRes.status).toBe(200);

      // Retrieve agent card
      const cardRes = await app.request(
        `/funny/${agentId}/.well-known/agent-card.json`
      );
      const cardBody = (await cardRes.json()) as { name: string; url: string };
      expect(cardRes.status).toBe(200);
      expect(cardBody.name).toBe("integration-test-agent");
      expect(cardBody.url).toBe(`https://silly.com/funny/${agentId}`);
    });

    it("should return error for non-existent agent", async () => {
      const storage = new InMemoryStore();

      const { app } = fleet(
        {
          get: undefined as unknown as RequestAgentRoute["implementation"],
          set: undefined as unknown as CreateAgentRoute["implementation"],
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const res = await app.request(
        "/agentId/non-existent-agent/.well-known/agent-card.json"
      );
      // Should return error for not found
      const body = (await res.json()) as { error?: unknown };
      expect(body.error).toBeDefined();
    });

    it("should route agent card requests through the retrieve handler", async () => {
      const storage = new InMemoryStore();
      const mockGet = jest.fn(() =>
        Promise.resolve({
          type: "success" as const,
          result: {
            name: "test-agent",
            url: "http://localhost/agent/test",
            version: "1.0.0",
          },
        })
      ) as unknown as RequestAgentRoute["implementation"];

      const { app } = fleet(
        {
          get: mockGet,
          set: jest.fn() as unknown as CreateAgentRoute["implementation"],
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const res = await app.request(
        "/agentId/test-agent/.well-known/agent-card.json"
      );
      expect(res.status).toBe(200);
      expect(mockGet).toHaveBeenCalled();
      // Verify the handler received correct method
      const callArgs = (mockGet as jest.MockedFunction<typeof mockGet>).mock
        .calls[0] as unknown[];
      expect((callArgs[0] as { method: string }).method).toBe("agentcard/get");
    });

    it("should route JSON-RPC requests through the retrieve handler", async () => {
      const storage = new InMemoryStore();
      const mockGet = jest.fn(() =>
        Promise.resolve({
          type: "success" as const,
          result: {
            kind: "task" as const,
            id: "task-1",
            contextId: "ctx-1",
            status: { state: "completed" as const },
          },
        })
      ) as unknown as RequestAgentRoute["implementation"];

      const { app } = fleet(
        {
          get: mockGet,
          set: jest.fn() as unknown as CreateAgentRoute["implementation"],
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const res = await app.request("/agentId/test-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "req-1",
          method: "message/send",
          params: {
            message: {
              messageId: "msg-1",
              kind: "message",
              role: "user",
              parts: [{ kind: "text", text: "Hello" }],
            },
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(mockGet).toHaveBeenCalled();
      const body = (await res.json()) as { jsonrpc: string; result: unknown };
      expect(body.jsonrpc).toBe("2.0");
      expect(body.result).toBeDefined();
      expect((body.result as { kind: string }).kind).toBe("task");
    });

    it("should return JSON-RPC error for handler errors", async () => {
      const storage = new InMemoryStore();

      const { app } = fleet(
        {
          get: RequestAgent, // Uses real implementation which will fail without agent in storage
          set: jest.fn() as unknown as CreateAgentRoute["implementation"],
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const res = await app.request(
        "/agentId/non-existent-agent/.well-known/agent-card.json"
      );

      const body = (await res.json()) as { error?: unknown };
      expect(body.error).toBeDefined();
    });

    it.skip("should deploy an agent and send a message to it", async () => {
      const storage = new InMemoryStore();

      const { app } = fleet(
        {
          get: RequestAgent,
          set: CreateAgent,
          baseUrl: "https://localhost:3000",
          agentPath: "/agent",
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const deployRes = await app.request("/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            name: "integration-test-agent",
            description: "An agent for integration testing",
            modelId: "gpt-4",
            instructions: "You are a helpful assistant",
            uri: "integration-test",
            skills: [],
            version: "1.0.0",
            toolIds: [],
            groupIds: [],
            services: [],
            capabilities: { streaming: false },
            defaultInputModes: ["text"],
            defaultOutputModes: ["text"],
          },
        }),
      });

      expect(deployRes.status).toBe(200);
      const deployBody = await deployRes.json();
      const { agentId } = deployBody as { agentId: string };
      expect(agentId).toBeDefined();
      const messageRes = await app.request(`/agent/${agentId.trim()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "req-1",
          method: "message/send",
          params: {
            message: des6.message("Hello"),
          },
        }),
      });
      expect([400, 500]).toContain(messageRes.status);
      const messageBody = (await messageRes.json()) as { error?: unknown };
      expect(messageBody.error).toBeDefined();
    });
  });
});
