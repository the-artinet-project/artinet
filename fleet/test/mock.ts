import { jest } from "@jest/globals";
import { Context as HonoContext } from "hono";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import * as SDK from "@artinet/sdk";
import * as armada from "@artinet/armada";
import { AgentConfiguration } from "agent-def";

import { RequestContext } from "../src/routes/request/types/definitions.js";

/**
 * Simple in-memory store for testing purposes
 * Reused from routes/request.test.ts pattern
 */
export class MockStore<T> implements armada.IDataStore<T> {
  private data: Map<string, T> = new Map();

  async get(key: string): Promise<T | undefined> {
    return this.data.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async search(query: string): Promise<T[]> {
    return Array.from(this.data.values());
  }
}

/**
 * Mock agent that implements the SDK.Agent interface minimally
 */
export const createMockAgent = (
  name: string = "test-agent",
  overrides: Partial<SDK.Agent> = {}
): SDK.Agent =>
  ({
    sendMessage: jest.fn(() =>
      Promise.resolve({
        kind: "task" as const,
        id: "task-1",
        contextId: "context-1",
        status: { state: "completed" as const },
        artifacts: [],
        history: [],
      })
    ),
    streamMessage: jest.fn(async function* () {
      yield {
        kind: "status-update" as const,
        taskId: "task-1",
        status: { state: "working" as const },
        contextId: "context-1",
        final: false,
      };
      yield {
        kind: "status-update" as const,
        taskId: "task-1",
        status: { state: "completed" as const },
        contextId: "context-1",
        final: true,
      };
    }),
    getTask: jest.fn(() =>
      Promise.resolve({
        kind: "task" as const,
        id: "task-1",
        contextId: "context-1",
        status: { state: "completed" as const },
        artifacts: [],
        history: [],
      })
    ),
    cancelTask: jest.fn(() =>
      Promise.resolve({
        kind: "task" as const,
        id: "task-1",
        contextId: "context-1",
        status: { state: "canceled" as const },
        artifacts: [],
        history: [],
      })
    ),
    getAgentCard: jest.fn(() =>
      Promise.resolve({
        name,
        url: `http://localhost:3000/agent/${name}`,
        version: "1.0.0",
        protocolVersion: "0.3.0",
        capabilities: {
          streaming: true,
          pushNotifications: false,
          stateTransitionHistory: false,
          extensions: [],
        },
        defaultInputModes: ["text"],
        defaultOutputModes: ["text"],
        skills: [],
      })
    ),
    resubscribe: jest.fn(async function* () {
      yield {
        kind: "status-update" as const,
        taskId: "task-1",
        status: { state: "completed" as const },
        contextId: "context-1",
        final: true,
      };
    }),
    ...overrides,
  } as SDK.Agent);

/**
 * Valid agent configuration for tests
 */
export const createValidAgentConfig = (
  overrides: Partial<AgentConfiguration> = {}
): AgentConfiguration => ({
  schemaVersion: "0.1.0",
  uri: "test-agent-uri",
  name: "test-agent",
  description: "A test agent",
  modelId: "gpt-4",
  instructions: "You are a helpful assistant",
  skills: [
    {
      name: "test-skill",
      id: "test-skill-id",
      description: "A test skill",
      tags: ["test"],
    },
  ],
  version: "1.0.0",
  toolUris: [],
  groupIds: [],
  services: [],
  capabilities: { streaming: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  ...overrides,
});

export const createValidStoredAgent = (
  overrides: Partial<armada.StoredAgent> = {}
): armada.StoredAgent => ({
  uri: "test-agent-id",
  name: "test-agent",
  configuration: createValidAgentConfig(),
  version: "1.0.0",
  updatedAt: new Date().toISOString(),
  status: "ACTIVE",
  visibility: "PUBLIC",
  owner: "test-owner",
  ...overrides,
});
/**
 * Creates a mock RequestContext for testing
 */
export const createMockContext = (
  overrides: Partial<RequestContext> = {}
): RequestContext => ({
  baseUrl: "https://localhost:3000",
  agentPath: "/agent",
  agentId: "test-agent-id",
  storage: new MockStore(),
  load: jest.fn(() => Promise.resolve(createMockAgent())),
  invoke: jest.fn(() =>
    Promise.resolve({
      type: "success" as const,
      result: {
        kind: "task" as const,
        id: "task-1",
        contextId: "context-1",
        status: { state: "completed" as const },
        artifacts: [],
        history: [],
      },
    })
  ),
  ...overrides,
});

/**
 * Creates a mock Express response
 */
export const createMockResponse = (): Partial<Response> & {
  _json: unknown;
  _headers: Record<string, unknown>;
  _statusCode: number;
  _written: string[];
  _ended: boolean;
} => {
  const res: any = {
    _json: null,
    _headers: {},
    _statusCode: 200,
    _written: [],
    _ended: false,
    json: jest.fn(function (data: unknown) {
      res._json = data;
      return res;
    }),
    status: jest.fn(function (code: number) {
      res._statusCode = code;
      return res;
    }),
    writeHead: jest.fn(function (
      code: number,
      headers: Record<string, unknown>
    ) {
      res._statusCode = code;
      res._headers = headers;
      return res;
    }),
    write: jest.fn(function (data: string) {
      res._written.push(data);
      return res;
    }),
    end: jest.fn(function () {
      res._ended = true;
      return res;
    }),
  };
  return res;
};

/**
 * Creates a mock Express request
 */
export const createMockRequest = (
  overrides: Partial<ExpressRequest> = {}
): Partial<ExpressRequest> => ({
  body: {},
  params: {},
  path: "/test",
  headers: {},
  ...overrides,
});

/**
 * Creates a mock Express request
 */
export const createMockHonoRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  body: null,
  headers: new Headers(),
  ...overrides,
});
