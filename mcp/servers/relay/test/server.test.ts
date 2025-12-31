import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jest, describe, it, expect, afterAll, beforeAll } from "@jest/globals";
import {
  createAgentServer,
  AgentBuilder,
  ExpressAgentServer,
  TaskState,
  Task,
  AgentCard,
} from "@artinet/sdk";
import { Server } from "http";
jest.setTimeout(10000);
const base_args = ["dist/bin/stdio.js", "test-caller", "3000", "3100"];
const testAgentCard: AgentCard = {
  name: "test-agent",
  url: "http://localhost:3000/a2a",
  description: "A test agent",
  version: "1.0.0",
  protocolVersion: "0.3.0",
  capabilities: {
    streaming: true,
    pushNotifications: true,
    stateTransitionHistory: true,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "test-skill",
      name: "test-skill",
      description: "A test skill",
      tags: [],
    },
  ],
};
describe.only("RelayMCPServer", () => {
  let agentServer: ExpressAgentServer;
  let httpServer: Server;
  beforeAll(async () => {
    agentServer = createAgentServer({
      agent: AgentBuilder()
        .text(async ({ content }) => {
          if (content === "poll") {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          return "hello world!";
        })
        .createAgent({
          agentCard: testAgentCard,
        }),
      basePath: "/a2a",
    });
    httpServer = agentServer.app.listen(3000, () => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });
  afterAll(async () => {
    await httpServer?.close();
    await agentServer.agent.stop();
  });
  describe("basic stdio calls", () => {
    let client: Client;
    let transport: StdioClientTransport;
    beforeAll(async () => {
      transport = new StdioClientTransport({
        command: "node",
        args: base_args,
      });
      client = new Client({ name: "Relay Client", version: "1.0.0" }, {});
      await client.connect(transport);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    afterAll(async () => {
      await transport?.close();
      await client?.close();
    });
    it("should work with stdio transport", async () => {
      const response = await client.callTool({
        name: "sendMessage",
        arguments: {
          agentId: "test-agent",
          message: "Hi!",
        },
      });
      const taskResponse = ((response as CallToolResult).content[0] as any)
        .text as string;
      expect(taskResponse).toBe("hello world!");
      expect(
        ((response as CallToolResult).structuredContent?.result as Task)?.status
          ?.state
      ).toBe(TaskState.completed);
    }, 10000);
    it("should get the task status", async () => {
      const response = client.callTool({
        name: "sendMessage",
        arguments: {
          agentId: "test-agent",
          message: "poll",
          taskId: "123",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const task = (
        await client.callTool({
          name: "getTask",
          arguments: {
            agentId: "test-agent",
            taskId: "123",
          },
        })
      ).structuredContent as Task;
      expect(task?.status?.state).toBe(TaskState.submitted);
      const fullResponse = ((await response) as CallToolResult)
        .structuredContent?.result as Task;
      expect(fullResponse?.id).toBe("123");
      expect(fullResponse?.status?.state).toBe(TaskState.completed);
    }, 10000);
    it("should cancel a task", async () => {
      const response = client.callTool({
        name: "sendMessage",
        arguments: {
          agentId: "test-agent",
          message: "poll",
          taskId: "123",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const task = (
        await client.callTool({
          name: "cancelTask",
          arguments: {
            agentId: "test-agent",
            taskId: "123",
          },
        })
      ).structuredContent as Task;
      expect(task?.status?.state).toBe(TaskState.canceled);
      //todo fix race condition in task cancellation
      const fullResponse = ((await response) as CallToolResult)
        .structuredContent?.result as Task;
      expect(fullResponse?.id).toBe("123");
    }, 10000);
    it("should get agent card", async () => {
      const response = await client.callTool({
        name: "getAgentCard",
        arguments: {
          agentId: "test-agent",
        },
      });
      const agentCard = (response as CallToolResult)
        .structuredContent as AgentCard;
      expect(agentCard?.name).toBe("test-agent");
    }, 10000);
  });
  describe("advanced stdio calls", () => {
    it("should view agents", async () => {
      const agentServer2 = createAgentServer({
        agent: AgentBuilder()
          .text(async ({ content }) => {
            if (content === "poll") {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            return "hello world!";
          })
          .createAgent({
            agentCard: {
              ...testAgentCard,
              name: "test-agent-2",
              url: "http://localhost:3002/a2a",
            },
          }),
        basePath: "/a2a",
      });
      const httpServer2 = agentServer2.app.listen(3002, () => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const transport_ = new StdioClientTransport({
        command: "node",
        args: base_args,
      });
      const client_ = new Client(
        { name: "Relay Client", version: "1.0.0" },
        {}
      );
      await client_.connect(transport_);
      const response = await client_.callTool({
        name: "viewAgents",
      });
      const agents = (response as CallToolResult).structuredContent
        ?.agents as AgentCard[];
      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe("test-agent");
      expect(agents[1].name).toBe("test-agent-2");
      await transport_.close();
      await client_.close();
      await httpServer2.close();
      await agentServer2.agent.stop();
    }, 10000);
    it("should search agents", async () => {
      const agentServer2 = createAgentServer({
        agent: AgentBuilder()
          .text(async ({ content }) => {
            if (content === "poll") {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            return "hello world!";
          })
          .createAgent({
            agentCard: {
              ...testAgentCard,
              name: "test-agent-2",
              url: "http://localhost:3002/a2a",
            },
          }),
        basePath: "/a2a",
      });
      const httpServer2 = agentServer2.app.listen(3002, () => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const transport_ = new StdioClientTransport({
        command: "node",
        args: base_args,
      });
      const client_ = new Client(
        { name: "Relay Client", version: "1.0.0" },
        {}
      );
      await client_.connect(transport_);
      const response = await client_.callTool({
        name: "searchAgents",
        arguments: {
          query: "test-agent-2",
        },
      });
      const agents = (response as CallToolResult).structuredContent
        ?.agents as AgentCard[];
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("test-agent-2");
      await client_.close();
      await transport_.close();
      await httpServer2.close();
      await agentServer2.agent.stop();
    }, 10000);

    it("should find multiple agents", async () => {
      const transport_ = new StdioClientTransport({
        command: "node",
        args: base_args,
      });
      const client_ = new Client(
        { name: "Relay Client", version: "1.0.0" },
        {}
      );
      await client_.connect(transport_);
      const httpServers: Server[] = [];
      const agentServers: ExpressAgentServer[] = [];
      for (let i = 0; i < 10; i++) {
        agentServers.push(
          createAgentServer({
            agent: AgentBuilder()
              .text(() => "hello world!")
              .createAgent({
                agentCard: {
                  ...testAgentCard,
                  name: `test-agent-${i}`,
                  url: `http://localhost:${3002 + i}/a2a`,
                },
              }),
            basePath: "/a2a",
          })
        );
        httpServers.push(agentServers[i].app.listen(3002 + i, () => {}));
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await client_.callTool({
        name: "viewAgents",
      });
      const agents = (response as CallToolResult).structuredContent
        ?.agents as AgentCard[];
      expect(agents).toHaveLength(11);
      await client_.close();
      await transport_.close();
      await Promise.all(httpServers.map((httpServer) => httpServer.close()));
      await Promise.all(
        agentServers.map((agentServer) => agentServer.agent.stop())
      );
    }, 15000);
  });
});
