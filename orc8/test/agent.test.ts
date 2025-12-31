/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { jest, describe, afterEach, it, expect } from "@jest/globals";
import {
  createAgent,
  A2AClient,
  createAgentServer,
  A2A,
  Service as AgentService,
} from "@artinet/sdk";
import { Runtime } from "@artinet/types";
import { Agent } from "../src/agent.js";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";
import { callAgent } from "../src/agent-util.js";
import http from "http";
jest.setTimeout(30000);

describe("Agent Tests", () => {
  let agent: Agent | undefined;

  afterEach(async () => {
    if (agent) {
      await agent.stop();
      agent = undefined;
    }
  });

  describe("Agent.create", () => {
    it("should create an agent from CreateAgentParams", async () => {
      agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      expect(agent).toBeDefined();
      expect(agent.kind).toBe("agent");
      expect(agent.uri).toBe("test-agent-uri");
    });

    it("should create agent with auto-generated URI", async () => {
      agent = Agent.create({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });

      expect(agent).toBeDefined();
      expect(agent.uri).toBeDefined();
      expect(typeof agent.uri).toBe("string");
    });
  });

  describe("Agent.from", () => {
    it("should create an agent wrapper from existing A2A agent", async () => {
      const a2aAgent = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });

      agent = Agent.from(a2aAgent, "wrapped-agent-uri");

      expect(agent).toBeDefined();
      expect(agent.kind).toBe("agent");
      expect(agent.uri).toBe("wrapped-agent-uri");
    });
  });

  describe("Agent.getInfo", () => {
    it("should return agent info", async () => {
      agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      const info = await agent.getInfo();

      expect(info).toBeDefined();
      expect(info.name).toBe("test-agent");
      expect(info.description).toBe("A test agent for unit tests");
      expect(info.uri).toBe("test-agent-uri");
    });
  });

  describe("Agent.getTarget", () => {
    it("should return agent service target", async () => {
      agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      const target = await agent.getTarget();

      expect(target).toBeDefined();
      expect(target.type).toBe("a2a");
      expect(target.uri).toBe("test-agent-uri");
      expect(target.info).toBeDefined();
    });
  });

  describe("Agent.execute", () => {
    it("should execute an agent request with string call", async () => {
      agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      const request: Runtime.AgentRequest = {
        type: "a2a",
        kind: "agent_request",
        uri: "test-agent-uri",
        call: "Hello, Agent!",
        id: "test-request-id",
      };

      const response = await agent.execute({
        request,
        options: {
          parentTaskId: "test-task-id",
          tasks: { "test-task-id": {} },
        },
      });

      expect(response).toBeDefined();
      expect(response.kind).toBe("agent_response");
      expect(response.uri).toBe("test-agent-uri");
    });

    it("should throw error for mismatched URI", async () => {
      agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      const request: Runtime.AgentRequest = {
        type: "a2a",
        kind: "agent_request",
        uri: "wrong-uri",
        call: "test message",
        id: "test-request-id",
      };

      await expect(
        agent.execute({
          request,
          options: {
            parentTaskId: "test-task-id",
            tasks: {},
          },
        })
      ).rejects.toThrow("Invalid request URI");
    });
  });

  describe("Agent.stop", () => {
    it("should stop the agent", async () => {
      agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      await expect(agent.stop()).resolves.not.toThrow();
      agent = undefined;
    });
  });
});

describe("Agent Utility Tests", () => {
  describe("callAgent", () => {
    it("should call an agent directly", async () => {
      const a2aAgent = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });

      const request: Runtime.AgentRequest = {
        type: "a2a",
        kind: "agent_request",
        uri: "test-agent",
        call: "direct test call",
        id: "test-id",
      };

      const response = await callAgent(a2aAgent, "test-agent", request, {
        parentTaskId: "test-task-id",
        tasks: { "test-task-id": {} },
      });

      expect(response).toBeDefined();
      expect(response.kind).toBe("agent_response");
      expect(response.uri).toBe("test-agent");
      expect(response.result).toBeDefined();
      expect((response.result as A2A.Task).status.message?.parts[0]).toEqual({
        kind: "text",
        text: "Echo: direct test call",
      });

      await a2aAgent.stop();
    });
  });
});

describe("Agent with A2AClient", () => {
  let server: http.Server;
  let serverAgent: AgentService;
  let agent: Agent;

  beforeAll(async () => {
    serverAgent = createAgent({
      engine: echoAgentEngine,
      agentCard: {
        ...testAgentCard,
        url: "http://localhost:3003",
      },
    });
    const agentServer = createAgentServer({
      agent: serverAgent,
      agentCardPath: "/.well-known/agent-card.json",
    });
    server = agentServer.app.listen(3003);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const client = new A2AClient("http://localhost:3003");
    agent = Agent.from(client, "client-agent-uri");
  });

  afterAll(async () => {
    if (agent) {
      await agent.stop();
    }
    await serverAgent.stop();
    await server.close();
  });

  it("should work with an A2AClient", async () => {
    expect(agent).toBeDefined();
    expect(agent.kind).toBe("agent");

    const info = await agent.getInfo();
    expect(info.name).toBe("test-agent");
  });

  it("should call an A2AClient", async () => {
    const response = await agent.execute({
      request: {
        id: "test-request-id",
        type: "a2a",
        kind: "agent_request",
        uri: "client-agent-uri",
        call: "test call",
      },
      options: {
        parentTaskId: "test-task-id",
        tasks: { "test-task-id": {} },
      },
    });

    expect(response).toBeDefined();
    expect(response.kind).toBe("agent_response");
    expect(response.uri).toBe("client-agent-uri");
    expect(response.result).toBeDefined();
    expect((response.result as A2A.Task).status.message?.parts[0]).toEqual({
      kind: "text",
      text: "Echo: test call",
    });
  });
});
