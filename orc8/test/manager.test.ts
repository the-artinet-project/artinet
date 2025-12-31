/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { jest, describe, afterEach, it, expect } from "@jest/globals";
import { Runtime } from "@artinet/types";
import { Manager } from "../src/manager.js";
import { Agent } from "../src/agent.js";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";
import { A2A } from "@artinet/sdk";
jest.setTimeout(30000);

describe("Manager Tests", () => {
  let manager: Manager;

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  describe("Manager basics", () => {
    it("should create an empty manager", async () => {
      manager = new Manager();

      expect(manager).toBeDefined();
      expect(manager.count).toBe(0);
      expect(manager.uris).toEqual([]);
      expect(manager.values).toEqual([]);
    });

    it("should add an agent", async () => {
      manager = new Manager();

      const agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      await manager.set("test-agent-uri", agent);

      expect(manager.count).toBe(1);
      expect(manager.uris).toContain("test-agent-uri");
    });

    /**
     * Tool tests are run in a separate describe block to avoid
     * connection issues with Jest's test isolation.
     * See the "Tool class" tests in tool.test.ts for comprehensive tool testing.
     */
    it("should get a callable by URI", async () => {
      manager = new Manager();

      const agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      await manager.set("test-agent-uri", agent);

      const retrieved = await manager.get("test-agent-uri");
      expect(retrieved).toBe(agent);
    });

    it("should return undefined for non-existent URI", async () => {
      manager = new Manager();

      const retrieved = await manager.get("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should delete a callable", async () => {
      manager = new Manager();

      const agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      await manager.set("test-agent-uri", agent);
      expect(manager.count).toBe(1);

      await manager.delete("test-agent-uri");
      expect(manager.count).toBe(0);
    });

    it("should list all callables", async () => {
      manager = new Manager();

      const agent1 = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "agent-1"
      );

      const agent2 = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: { ...testAgentCard, name: "test-agent-2" },
        },
        "agent-2"
      );

      await manager.set("agent-1", agent1);
      await manager.set("agent-2", agent2);

      const list = await manager.list();
      expect(list.length).toBe(2);
    });
  });

  describe("Manager.call", () => {
    it("should call multiple agents", async () => {
      manager = new Manager();

      const agent1 = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "agent-1"
      );

      const agent2 = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: { ...testAgentCard, name: "test-agent-2" },
        },
        "agent-2"
      );

      await manager.set("agent-1", agent1);
      await manager.set("agent-2", agent2);

      const requests: Runtime.AgentRequest[] = [
        {
          type: "a2a",
          kind: "agent_request",
          uri: "agent-1",
          call: "message to agent 1",
          id: "request-1",
        },
        {
          type: "a2a",
          kind: "agent_request",
          uri: "agent-2",
          call: "message to agent 2",
          id: "request-2",
        },
      ];

      const responses = await manager.call({
        request: requests,
        options: {
          parentTaskId: "parent-task-id",
          tasks: { "parent-task-id": {} },
        },
      });

      expect(responses.length).toBe(2);
      expect(
        (responses[0].result as A2A.Task).status.message?.parts[0]
      ).toEqual({
        kind: "text",
        text: "Echo: message to agent 1",
      });
      expect(
        (responses[1].result as A2A.Task).status.message?.parts[0]
      ).toEqual({
        kind: "text",
        text: "Echo: message to agent 2",
      });
    });

    it("should handle empty request array", async () => {
      manager = new Manager();

      const responses = await manager.call({
        request: [],
        options: {
          parentTaskId: "parent-task-id",
          tasks: {},
        },
      });

      expect(responses).toEqual([]);
    });

    it("should handle request for non-existent callable", async () => {
      manager = new Manager();

      const requests: Runtime.AgentRequest[] = [
        {
          type: "a2a",
          kind: "agent_request",
          uri: "non-existent",
          call: "message",
          id: "request-1",
        },
      ];

      const responses = await manager.call({
        request: requests,
        options: {
          parentTaskId: "parent-task-id",
          tasks: {},
        },
      });

      expect(responses.length).toBe(0);
    });
  });

  describe("Manager.stop", () => {
    it("should stop all callables", async () => {
      manager = new Manager();

      const agent = Agent.create(
        {
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        },
        "test-agent-uri"
      );

      await manager.set("test-agent-uri", agent);
      await expect(manager.stop()).resolves.not.toThrow();
    });
  });
});
