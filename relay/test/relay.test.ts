import { Discover, Relay } from "../src/index.js";
import * as sdk from "@artinet/sdk";
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from "@jest/globals";
import { Server } from "http";
jest.setTimeout(10000);
const testAgentCard: sdk.A2A.AgentCard = {
  name: "test-agent",
  url: "http://localhost:3001/a2a",
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

describe("AgentRelay", () => {
  let agentServer: sdk.ExpressAgentServer;
  let server: Server;
  it("should pass empty array when no servers found", async () => {
    const configs = await Discover.scan({
      host: "localhost",
      startPort: 3000,
      endPort: 6000,
      threads: 10,
    });
    expect(configs).toHaveLength(0);
  });
  it("relay should be empty when no agents found", async () => {
    const relay = await Discover.create({
      callerId: "test-caller",
      host: "localhost",
      startPort: 3000,
      endPort: 6000,
      abortSignal: new AbortController().signal,
      syncInterval: 2500,
    });
    expect(relay.count).toBe(0);
    await relay.stop();
    await sdk.sleep(1000);
  });
  describe("scanAgents", () => {
    beforeEach(async () => {
      agentServer = sdk
        .cr8(testAgentCard, {
          basePath: "/a2a",
        })
        .text("hello world!").server;
      server = agentServer.app.listen(3001, () => {});
      //wait for server to start
      await sdk.sleep(1000);
    });
    afterEach(async () => {
      server.close();
      await sdk.sleep(100);
    });
    it("it should detect local agent server", async () => {
      const configs = await Discover.scan({
        host: "localhost",
        startPort: 3000,
        endPort: 3001,
      });
      expect(configs).toHaveLength(1);
      expect(configs[0].baseUrl).toBe("http://localhost:3001");
      expect(configs[0].headers).toBeUndefined();
      expect(configs[0].fallbackPath).toBeUndefined();
    });

    it("should detect multiple local servers", async () => {
      const server2 = agentServer.app.listen(4002, () => {});
      const configs = await Discover.scan({
        host: "localhost",
        startPort: 3000,
        endPort: 5000,
      });
      expect(configs).toHaveLength(2);
      expect(configs[0].baseUrl).toBe("http://localhost:3001");
      expect(configs[1].baseUrl).toBe("http://localhost:4002");
      server2.close();
    });
    describe("Relay Operations", () => {
      let relay: Relay;
      beforeEach(async () => {
        relay = await Discover.create({
          callerId: "test-caller",
          host: "localhost",
          startPort: 3000,
          endPort: 5000,
          fallbackPath: "/a2a/.well-known/agent-card.json",
          abortSignal: new AbortController().signal,
          syncInterval: 2500,
        });
      });
      afterEach(async () => {
        await relay.stop();
      });
      it("should capture agents on start", async () => {
        expect(relay.count).toBeGreaterThanOrEqual(1);
      });
      it("should get agentIds", async () => {
        const agentIds = relay.uris;
        expect(agentIds.length).toBeGreaterThanOrEqual(1);
        expect(agentIds).toContain("test-agent");
      });
      it("should get agentCount", async () => {
        const agentCount = relay.count;
        expect(agentCount).toBeGreaterThanOrEqual(1);
      });
      it("should get agent", async () => {
        const agent = await relay.getAgent("test-agent");
        expect(agent).toBeDefined();
      });
      it("should get agentCard", async () => {
        const agentCard = await relay.getAgentCard({ agentId: "test-agent" });
        expect(agentCard).toBeDefined();
        expect(agentCard?.name).toBe("test-agent");
      });
      it("should search agents", async () => {
        const agents = await relay.searchAgents({ query: "test-agent" });
        expect(agents.length).toBeGreaterThanOrEqual(1);
        expect(agents[0].name).toBe("test-agent");
      });
      it("should send message", async () => {
        const messageSendParams: sdk.A2A.MessageSendParams = {
          message: {
            role: "user",
            kind: "message",
            parts: [
              {
                text: "hello",
                kind: "text",
              },
            ],
            messageId: "123",
          },
        };
        const response = await relay.sendMessage({
          agentId: "test-agent",
          messageSendParams: messageSendParams,
        });
        expect(response).toBeDefined();
        const content = sdk.extractTextContent(response);
        expect(content).toBe("hello world!");
      });
      it("should register agent", async () => {
        let timeoutId: NodeJS.Timeout | undefined = undefined;
        const testAgent = sdk
          .cr8({ ...testAgentCard, name: "test-agent-2" })
          .text(async () => {
            await new Promise((resolve) => {
              timeoutId = setTimeout(() => {
                resolve("hello world!");
              }, 4000);
            });
            return "hello world!";
          }).agent;
        const agentCard = await relay.registerAgent(testAgent);
        expect(agentCard).toBeDefined();
        expect(agentCard?.name).toBe("test-agent-2");
        await testAgent.stop();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      it("should get task", async () => {
        let timeoutId: NodeJS.Timeout | undefined = undefined;
        const testAgent = sdk.cr8(testAgentCard).text(async () => {
          await new Promise((resolve) => {
            timeoutId = setTimeout(() => {
              resolve("hello world!");
            }, 4000);
          });
          return "hello world!";
        }).agent;
        const agentCard = await relay.registerAgent(testAgent);
        await sdk.sleep(500);
        const response = relay.sendMessage({
          agentId: agentCard.name,
          messageSendParams: {
            message: {
              role: "user",
              kind: "message",
              taskId: "123",
              parts: [
                {
                  text: "hello",
                  kind: "text",
                },
              ],
              messageId: "123",
            },
          },
        });
        expect(response).toBeDefined();
        await sdk.sleep(500);
        const task = await relay.getTask({
          agentId: agentCard.name,
          taskQuery: {
            id: "123",
          },
        });
        expect(task).toBeDefined();
        expect(task?.status?.state).toBe("submitted");
        await testAgent.stop();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      it("should cancel task", async () => {
        let timeoutId: NodeJS.Timeout | undefined = undefined;
        const testAgent = sdk.cr8(testAgentCard).text(async () => {
          await new Promise((resolve) => {
            timeoutId = setTimeout(() => {
              resolve(true);
            }, 4000);
          });
          return "hello world!";
        }).agent;
        const agentCard = await relay.registerAgent(testAgent);
        await sdk.sleep(500);
        const response = relay.sendMessage({
          agentId: agentCard.name,
          messageSendParams: {
            message: {
              role: "user",
              kind: "message",
              taskId: "123",
              parts: [
                {
                  text: "hello",
                  kind: "text",
                },
              ],
              messageId: "123",
            },
          },
        });
        expect(response).toBeDefined();
        await sdk.sleep(500);
        const task = await relay.cancelTask({
          agentId: agentCard.name,
          taskId: {
            id: "123",
          },
        });
        expect(task?.status?.state).toBe("canceled");
        await testAgent.stop();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      it("should detect new agent", async () => {
        expect(relay.count).toBe(1);
        const agentServer2 = sdk
          .cr8({ ...testAgentCard, name: "test-agent-2" })
          .text("hello world!").server;
        const server2 = agentServer2.app.listen(4005, () => {});
        await sdk.sleep(3000);
        expect(relay.count).toBe(2);
        server2.close();
      }, 100000);
      it("should detect multiple agents", async () => {
        expect(relay.count).toBe(1);
        const httpServers: Server[] = [];
        const agentServers: sdk.ExpressAgentServer[] = [];
        for (let i = 0; i < 10; i++) {
          agentServers.push(
            sdk
              .cr8({
                ...testAgentCard,
                name: `test-agent-${i}`,
                url: `http://localhost:${3002 + i}`,
              })
              .text("hello world!").server
          );
          httpServers.push(agentServers[i].app.listen(3002 + i, () => {}));
        }
        await sdk.sleep(3000);
        expect(relay.count).toBe(11);
        const agentIds = relay.uris;
        expect(agentIds.length).toBe(11);
        for (let i = 0; i < 10; i++) {
          expect(agentIds).toContain(`test-agent-${i}`);
        }
        await Promise.all(httpServers.map((httpServer) => httpServer.close()));
        await Promise.all(
          agentServers.map((agentServer) => agentServer.agent.stop())
        );
      }, 100000);
      it("should remove dead agents", async () => {
        expect(relay.count).toBe(1);
        const httpServers: Server[] = [];
        const agentServers: sdk.ExpressAgentServer[] = [];
        for (let i = 0; i < 2; i++) {
          agentServers.push(
            sdk
              .cr8({
                ...testAgentCard,
                name: `test-agent-${i}`,
                url: `http://localhost:${3002 + i}`,
              })
              .text("hello world!").server
          );
          httpServers.push(agentServers[i].app.listen(3002 + i, () => {}));
        }
        await sdk.sleep(3000);
        expect(relay.count).toBe(3);
        httpServers[0].close();
        await agentServers[0].agent.stop();
        await sdk.sleep(3000);
        expect(relay.count).toBe(2);
        httpServers[1].close();
        await agentServers[1].agent.stop();
        await sdk.sleep(3000);
        expect(relay.count).toBe(1);
      }, 150000);
    });
  });
});
