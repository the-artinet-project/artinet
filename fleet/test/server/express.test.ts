import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

import { fleet, Settings } from "../../src/server/express/server.js";
import * as agentRequest from "../../src/server/express/agent-request.js";
import * as deployRequest from "../../src/server/express/deploy-request.js";
import * as testRequest from "../../src/server/express/test-request.js";
import {
  toJSONRPCResponse,
  handleJSONRPCResponse,
} from "../../src/server/express/rpc.js";
import { generateRequestId } from "../../src/server/express/utils.js";
import { ResultOrError } from "../../src/types.js";
import {
  RequestAgentRoute,
  TestAgentRoute,
} from "../../src/routes/request/types/definitions.js";
import { CreateAgentRoute } from "../../src/routes/create/index.js";
import {
  createMockRequest,
  createMockResponse,
  createMockContext,
  createValidAgentConfig,
  MockStore,
} from "../mock.js";
import { loadAgent, invokeAgent } from "../../src/routes/request/index.js";
import { InMemoryStore } from "../../src/storage/in-memory.js";
import { RequestAgent } from "../../src/routes/request/index.js";
import { CreateAgent } from "../../src/routes/create/index.js";
import { applyDefaults } from "@artinet/sdk";
import { describe as des6 } from "@artinet/sdk";
// applyDefaults();
describe("Express Server", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("utils.ts - generateRequestId", () => {
    it("should return context requestId if present", () => {
      const context = { requestId: "context-request-id" };
      const req = createMockRequest({
        headers: { "x-request-id": "header-request-id" },
        body: { id: "body-request-id" },
      });

      const result = generateRequestId(context, req as Request);

      expect(result).toBe("context-request-id");
    });

    it("should return x-request-id header if context requestId is missing", () => {
      const context = {};
      const req = createMockRequest({
        headers: { "x-request-id": "header-request-id" },
        body: { id: "body-request-id" },
      });

      const result = generateRequestId(context, req as Request);

      expect(result).toBe("header-request-id");
    });

    it("should return body id if context and header are missing", () => {
      const context = {};
      const req = createMockRequest({
        headers: {},
        body: { id: "body-request-id" },
      });

      const result = generateRequestId(context, req as Request);

      expect(result).toBe("body-request-id");
    });

    it("should generate UUID if all sources are missing", () => {
      const context = {};
      const req = createMockRequest({
        headers: {},
        body: {},
      });

      const result = generateRequestId(context, req as Request);

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
      const res = createMockResponse();
      const response: ResultOrError = {
        type: "success",
        result: { name: "test-agent" },
      };

      await handleJSONRPCResponse(
        res as unknown as Response,
        "req-1",
        "agentcard/get",
        response
      );

      expect(res.json).toHaveBeenCalledWith({ name: "test-agent" });
    });

    it("should return JSON-RPC response for non-agentcard success", async () => {
      const res = createMockResponse();
      const response: ResultOrError = {
        type: "success",
        result: { kind: "task", id: "task-1" },
      };

      await handleJSONRPCResponse(
        res as unknown as Response,
        "req-1",
        "message/send",
        response
      );

      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: "req-1",
        result: { kind: "task", id: "task-1" },
      });
    });

    it("should return JSON-RPC error response for error type", async () => {
      const res = createMockResponse();
      const response: ResultOrError = {
        type: "error",
        error: { code: -32600, message: "Invalid Request" },
      };

      await handleJSONRPCResponse(
        res as unknown as Response,
        "req-1",
        "message/send",
        response
      );

      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: "req-1",
        error: { code: -32600, message: "Invalid Request" },
      });
    });

    it("should stream SSE for stream type", async () => {
      const res = createMockResponse();
      const response: ResultOrError = {
        type: "stream",
        stream: (async function* () {
          yield { kind: "status-update", taskId: "task-1" };
          yield { kind: "status-update", taskId: "task-1", final: true };
        })(),
      };

      await handleJSONRPCResponse(
        res as unknown as Response,
        "req-1",
        "message/stream",
        response
      );

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      expect(res._written.length).toBe(2);
      expect(res._written[0]).toContain("data:");
      expect(res._ended).toBe(true);
    });

    it("should throw INTERNAL_ERROR for unknown response type", async () => {
      const res = createMockResponse();
      const response = { type: "unknown" } as unknown as ResultOrError;

      // SDK.INTERNAL_ERROR wraps the message, so we check for the SDK error format
      await expect(
        handleJSONRPCResponse(
          res as unknown as Response,
          "req-1",
          "message/send",
          response
        )
      ).rejects.toThrow(/Internal error/);
    });
  });

  describe("agent-request.ts", () => {
    describe("handle", () => {
      it("should transform agent-card.json path to agentcard/get request", async () => {
        const res = createMockResponse();
        const next = jest.fn();
        const mockHandler: RequestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test-agent" },
          })
        );

        // Empty body - the path detection should create the agentcard/get request
        const req = createMockRequest({
          path: "/agent/123/.well-known/agent-card.json",
          body: {},
        });

        const context = createMockContext();

        await agentRequest.handle(
          req as Request,
          res as unknown as Response,
          next as unknown as NextFunction,
          context,
          mockHandler
        );

        expect(mockHandler).toHaveBeenCalledWith(
          expect.objectContaining({ method: "agentcard/get" }),
          expect.any(Object)
        );
        // agentcard/get returns plain JSON, not JSON-RPC wrapped
        expect(res.json).toHaveBeenCalledWith({ name: "test-agent" });
      });

      it("should transform agent.json path to agentcard/get request", async () => {
        const res = createMockResponse();
        const next = jest.fn();
        const mockHandler: RequestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test-agent", version: "1.0.0" },
          })
        );

        const req = createMockRequest({
          path: "/agent/123/.well-known/agent.json",
          body: {},
        });

        const context = createMockContext();

        await agentRequest.handle(
          req as Request,
          res as unknown as Response,
          next as unknown as NextFunction,
          context,
          mockHandler
        );

        expect(mockHandler).toHaveBeenCalledWith(
          expect.objectContaining({ method: "agentcard/get" }),
          expect.any(Object)
        );
        expect(res.json).toHaveBeenCalledWith({
          name: "test-agent",
          version: "1.0.0",
        });
      });

      it("should skip schema validation for agent-card.json paths", async () => {
        const res = createMockResponse();
        const next = jest.fn();
        const mockHandler: RequestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test-agent" },
          })
        );

        // Invalid body that would fail schema validation - but should be ignored
        const req = createMockRequest({
          path: "/agent/123/agent-card.json",
          body: { invalid: "data", not: "jsonrpc" },
        });

        const context = createMockContext();

        // Should not throw since validation is skipped for agent-card.json paths
        await agentRequest.handle(
          req as Request,
          res as unknown as Response,
          next as unknown as NextFunction,
          context,
          mockHandler
        );

        expect(mockHandler).toHaveBeenCalled();
      });

      it("should parse JSON-RPC request body", async () => {
        const res = createMockResponse();
        const next = jest.fn();
        const mockHandler: RequestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { kind: "task", id: "task-1" },
          })
        );

        const req = createMockRequest({
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

        const context = createMockContext();

        await agentRequest.handle(
          req as Request,
          res as unknown as Response,
          next as unknown as NextFunction,
          context,
          mockHandler
        );

        expect(mockHandler).toHaveBeenCalledWith(
          expect.objectContaining({ method: "message/send" }),
          expect.any(Object)
        );
        expect(res.json).toHaveBeenCalled();
      });
    });

    describe("factory", () => {
      it("should create a handler with the provided implementation", async () => {
        const mockImpl: RequestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { name: "test" },
          })
        );

        const handler = agentRequest.factory(mockImpl);

        expect(typeof handler).toBe("function");
      });
    });

    describe("request", () => {
      it("should call next with error when agentId is missing", async () => {
        const req = createMockRequest({
          params: {},
          path: "/agent/",
        });
        const res = createMockResponse();
        const next = jest.fn();

        await agentRequest.request({
          request: req as Request,
          response: res as unknown as Response,
          next: next as unknown as NextFunction,
          context: createMockContext(),
          handler: jest.fn() as unknown as agentRequest.handler,
          user: jest.fn() as any,
        });

        // SDK.INVALID_REQUEST wraps the error with "Request payload validation error"
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        const error = (next as jest.Mock).mock.calls[0][0];
        expect(error.message).toMatch(
          /agentId is required|Request payload validation error/
        );
      });

      it("should call handler with agentId from params", async () => {
        const mockHandler = jest.fn<agentRequest.handler>();
        const req = createMockRequest({
          params: { agentId: "my-agent" },
          path: "/agent/my-agent",
        });
        const res = createMockResponse();
        const next = jest.fn();

        await agentRequest.request({
          request: req as Request,
          response: res as unknown as Response,
          next: next as unknown as NextFunction,
          context: createMockContext(),
          handler: mockHandler as agentRequest.handler,
          user: jest.fn() as any,
        });

        expect(mockHandler).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.any(Function),
          expect.objectContaining({ agentId: "my-agent" })
        );
      });

      it("should use custom agentIdParam", async () => {
        const mockHandler = jest.fn<agentRequest.handler>();
        const req = createMockRequest({
          params: { agentId: "deployment-123" },
          path: "/deployment/deployment-123",
        });
        const res = createMockResponse();
        const next = jest.fn();

        await agentRequest.request({
          request: req as Request,
          response: res as unknown as Response,
          next: next as unknown as NextFunction,
          context: createMockContext(),
          handler: mockHandler as agentRequest.handler,
          user: jest.fn() as any,
        });

        expect(mockHandler).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.any(Function),
          expect.objectContaining({ agentId: "deployment-123" })
        );
      });
    });
  });

  describe("deploy-request.ts", () => {
    describe("handle", () => {
      it("should parse request body and call deploy", async () => {
        const res = createMockResponse();
        const next = jest.fn();
        const mockDeploy: CreateAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({ agentId: "new-agent-123" })
        );

        // CreateAgentRequestSchema requires a 'config' field containing the agent configuration
        const req = createMockRequest({
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

        const context: CreateAgentRoute["context"] = {
          storage: new MockStore(),
        };

        await deployRequest.handle(
          req as Request,
          res as unknown as Response,
          next as unknown as NextFunction,
          context,
          mockDeploy
        );

        expect(mockDeploy).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({ name: "my-agent" }),
          }),
          expect.any(Object)
        );
        expect(res.json).toHaveBeenCalledWith({ agentId: "new-agent-123" });
      });
    });

    describe("factory", () => {
      it("should create a handler with the provided implementation", () => {
        const mockImpl: CreateAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({ agentId: "test" })
        );

        const handler = deployRequest.factory(mockImpl);

        expect(typeof handler).toBe("function");
      });
    });

    describe("request", () => {
      it("should add requestId to context", async () => {
        const mockHandler = jest.fn<deployRequest.handler>();
        const req = createMockRequest({
          body: {},
          headers: { "x-request-id": "deploy-req-123" },
        });
        const res = createMockResponse();
        const next = jest.fn();

        const context: CreateAgentRoute["context"] = {
          storage: new MockStore(),
        };

        await deployRequest.request({
          request: req as Request,
          response: res as unknown as Response,
          next: next as unknown as NextFunction,
          context,
          handler: mockHandler as deployRequest.handler,
          user: jest.fn() as any,
        });

        expect(mockHandler).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.any(Function),
          expect.objectContaining({ requestId: "deploy-req-123" })
        );
      });
    });
  });

  describe("test-request.ts", () => {
    describe("handle", () => {
      it("should parse test request and call test handler", async () => {
        const res = createMockResponse();
        const next = jest.fn();
        const mockTest: TestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({
            type: "success" as const,
            result: { kind: "task" as const, id: "test-task-1" },
          })
        );

        // TestRequestSchema extends CreateAgentRequestSchema with tests array
        // tests items must be MessageSendParams with a message object
        const req = createMockRequest({
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

        const context: TestAgentRoute["context"] = {
          agentId: "test-agent-id",
          storage: new MockStore(),
          load: jest.fn(),
          invoke: jest.fn(),
        };

        await testRequest.handle(
          req as Request,
          res as unknown as Response,
          next as unknown as NextFunction,
          context,
          mockTest
        );

        expect(mockTest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "test/invoke" }),
          expect.objectContaining({ target: expect.any(Object) })
        );
      });
    });

    describe("factory", () => {
      it("should create a handler with the provided implementation", () => {
        const mockImpl: TestAgentRoute["implementation"] = jest.fn(() =>
          Promise.resolve({ type: "success" as const, result: {} })
        );

        const handler = testRequest.factory(mockImpl);

        expect(typeof handler).toBe("function");
      });
    });

    describe("request", () => {
      it("should generate unique agentId for test", async () => {
        const mockHandler = jest.fn<testRequest.handler>();
        const req = createMockRequest({
          body: {},
        });
        const res = createMockResponse();
        const next = jest.fn();

        const context: Omit<TestAgentRoute["context"], "agentId"> = {
          storage: new MockStore(),
          load: jest.fn(),
          invoke: jest.fn(),
        };

        await testRequest.request({
          request: req as Request,
          response: res as unknown as Response,
          next: next as unknown as NextFunction,
          context,
          handler: mockHandler as testRequest.handler,
          user: jest.fn() as any,
        });

        expect(mockHandler).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.any(Function),
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
    it("should create an Express app with default routes", () => {
      const mockGet: RequestAgentRoute["implementation"] = jest.fn();
      const mockSet: CreateAgentRoute["implementation"] = jest.fn();

      const settings: Settings = {
        get: mockGet,
        set: mockSet,
        storage: new MockStore(),
        load: jest.fn(),
        invoke: jest.fn(),
      };

      const { app } = fleet(settings, {});

      expect(app).toBeDefined();
      expect(typeof app.use).toBe("function");
    });

    it("should use provided Express app", () => {
      const existingApp = express();
      const mockGet: RequestAgentRoute["implementation"] = jest.fn();
      const mockSet: CreateAgentRoute["implementation"] = jest.fn();

      const settings: Settings = {
        get: mockGet,
        set: mockSet,
        storage: new MockStore(),
        load: jest.fn(),
        invoke: jest.fn(),
      };

      const { app } = fleet(settings, { app: existingApp });

      expect(app).toBe(existingApp);
    });

    it("should apply auth middleware when provided", () => {
      const mockAuth = jest.fn(
        (req: Request, res: Response, next: NextFunction) => next()
      );
      const mockGet: RequestAgentRoute["implementation"] = jest.fn();
      const mockSet: CreateAgentRoute["implementation"] = jest.fn();

      const settings: Settings = {
        get: mockGet,
        set: mockSet,
        auth: mockAuth as unknown as Settings["auth"],
        storage: new MockStore(),
        load: jest.fn(),
        invoke: jest.fn(),
      };

      const { app } = fleet(settings, { authOnRetrieve: true });

      expect(app).toBeDefined();
    });

    it("should disable testing route when enableTesting is false", () => {
      const mockGet: RequestAgentRoute["implementation"] = jest.fn();
      const mockSet: CreateAgentRoute["implementation"] = jest.fn();
      const mockTest: TestAgentRoute["implementation"] = jest.fn();

      const settings: Settings = {
        get: mockGet,
        set: mockSet,
        test: mockTest,
        storage: new MockStore(),
        load: jest.fn(),
        invoke: jest.fn(),
      };

      const { app } = fleet(settings, { enableTesting: false });

      expect(app).toBeDefined();
    });

    it("should use custom paths when provided", () => {
      const mockGet: RequestAgentRoute["implementation"] = jest.fn();
      const mockSet: CreateAgentRoute["implementation"] = jest.fn();

      const settings: Settings = {
        basePath: "/api/v1",
        agentPath: "/custom-agents",
        deploymentPath: "/custom-deploy",
        testPath: "/custom-test",
        get: mockGet,
        set: mockSet,
        storage: new MockStore(),
        load: jest.fn(),
        invoke: jest.fn(),
      };

      const { app } = fleet(settings, {});

      expect(app).toBeDefined();
    });
  });

  describe("Integration tests", () => {
    let mockStorage: MockStore<any>;

    beforeEach(() => {
      mockStorage = new MockStore();
    });

    it("should return 404 for unknown routes", async () => {
      const mockGet: RequestAgentRoute["implementation"] = jest.fn(() =>
        Promise.resolve({
          type: "success" as const,
          result: { name: "test" },
        })
      );
      const mockSet: CreateAgentRoute["implementation"] = jest.fn(() =>
        Promise.resolve({ agentId: "new-agent" })
      );

      const { app } = fleet(
        {
          get: mockGet,
          set: mockSet,
          storage: mockStorage,
          load: jest.fn(),
          invoke: jest.fn(),
        },
        {}
      );

      const response = await request(app).get("/unknown-route");

      expect(response.status).toBe(404);
    });

    it("should handle deployment requests at deploymentPath", async () => {
      const mockSet: CreateAgentRoute["implementation"] = jest.fn(() =>
        Promise.resolve({ agentId: "deployed-agent-123" })
      );

      const { app } = fleet(
        {
          get: jest.fn(),
          set: mockSet,
          userId: "test-user-id",
          storage: mockStorage,
          load: jest.fn(),
          invoke: jest.fn(),
        },
        {}
      );

      // CreateAgentRequestSchema requires 'config' field
      const response = await request(app)
        .post("/deploy")
        .send({
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
        });
      expect(mockSet).toHaveBeenCalled();
      expect(response.body).toEqual({ agentId: "deployed-agent-123" });
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
      const deployResponse = await request(app)
        .post("/deploy")
        .send({
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
        });
      expect(deployResponse.status).toBe(200);
      const { agentId } = deployResponse.body;
      expect(agentId).toBeDefined();

      // Retrieve agent card
      const cardResponse = await request(app).get(
        `/funny/${agentId}/.well-known/agent-card.json`
      );
      expect(cardResponse.status).toBe(200);
      expect(cardResponse.body.name).toBe("integration-test-agent");
      expect(cardResponse.body.url).toBe(`https://silly.com/funny/${agentId}`);
    });

    it("should return error for non-existent agent", async () => {
      const storage = new InMemoryStore();

      const { app } = fleet(
        {
          get: undefined as any,
          set: undefined as any,
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const response = await request(app).get(
        "/agentId/non-existent-agent/.well-known/agent-card.json"
      );

      // Should return JSON-RPC error for not found
      expect(response.status).toBe(200); // JSON-RPC returns 200 with error in body
      expect(response.body.error).toBeDefined();
    });
    it("should route agent card requests through the retrieve handler", async () => {
      const storage = new InMemoryStore();
      const mockGet: RequestAgentRoute["implementation"] = jest.fn(() =>
        Promise.resolve({
          type: "success" as const,
          result: {
            name: "test-agent",
            url: "http://localhost/agent/test",
            version: "1.0.0",
          },
        })
      );

      const { app } = fleet(
        {
          get: mockGet,
          set: jest.fn() as any,
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const response = await request(app).get(
        "/agentId/test-agent/.well-known/agent-card.json"
      );

      expect(response.status).toBe(200);
      expect(mockGet).toHaveBeenCalled();
      // Verify the handler received correct method
      const callArgs = (mockGet as jest.Mock).mock.calls[0];
      expect(callArgs[0].method).toBe("agentcard/get");
    });

    it("should route JSON-RPC requests through the retrieve handler", async () => {
      const storage = new InMemoryStore();
      const mockGet: RequestAgentRoute["implementation"] = jest.fn(() =>
        Promise.resolve({
          type: "success" as const,
          result: {
            kind: "task" as const,
            id: "task-1",
            contextId: "ctx-1",
            status: { state: "completed" as const },
          },
        })
      );

      const { app } = fleet(
        {
          get: mockGet,
          set: jest.fn() as any,
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const response = await request(app)
        .post("/agentId/test-agent")
        .send({
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
        });

      expect(response.status).toBe(200);
      expect(mockGet).toHaveBeenCalled();
      expect(response.body.jsonrpc).toBe("2.0");
      expect(response.body.result).toBeDefined();
    });

    it("should return JSON-RPC error for handler errors", async () => {
      const storage = new InMemoryStore();

      const { app } = fleet(
        {
          get: RequestAgent, // Uses real implementation which will fail without agent in storage
          set: jest.fn() as any,
          storage,
          load: loadAgent,
          invoke: invokeAgent,
        },
        {}
      );

      const response = await request(app).get(
        "/agentId/non-existent-agent/.well-known/agent-card.json"
      );

      // Should return JSON-RPC error for not found
      expect(response.status).toBe(200); // JSON-RPC returns 200 with error in body
      expect(response.body.error).toBeDefined();
    });
    /**Requires Valid Backend for testing*/
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

      const deployResponse = await request(app)
        .post("/deploy")
        .send({
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
        });
      expect(deployResponse.status).toBe(200);
      const { agentId } = deployResponse.body;
      expect(agentId).toBeDefined();

      const messageResponse = await request(app)
        .post(`/agentId/${agentId}`)
        .send({
          jsonrpc: "2.0",
          id: "req-1",
          method: "message/send",
          params: {
            message: des6.message("Hello"),
          },
        });
      expect(messageResponse.status).toBe(400);
      expect(messageResponse.body.error).toBeDefined();
    });
  });
});
