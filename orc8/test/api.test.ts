/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { jest, describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import { API, Runtime } from "@artinet/types";
import { createAgent } from "@artinet/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { artinetProvider } from "../src/api/connect.js";
import { initClient, getToolInfo } from "../src/tool-util.js";
import { safeClose, safeStdioTransport } from "../src/utils/safeTransport.js";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";

jest.setTimeout(60000);

// Skip these tests as they make actual network calls to the Artinet API
describe.skip("API Tests", () => {
  let defaultRequest: API.ConnectRequest = {
    identifier: "deepseek-r1",
    messages: [{ role: "user", content: "test-message" }],
    preferredEndpoint: "auto",
    options: {},
  };

  let transport: StdioClientTransport;
  let client: Client;

  beforeAll(async () => {
    transport = safeStdioTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything@2025.11.25"],
    });
    client = await initClient(transport, "test-client");
  });

  afterAll(async () => {
    await safeClose(client, transport);
  });

  it("should connect to API", async () => {
    const response = await artinetProvider(defaultRequest);
    expect(response).toBeDefined();
    expect(response.message?.content).toBeDefined();
  });

  it("should send tool info to API", async () => {
    const toolInfo: Runtime.ToolInfo = await getToolInfo(
      "test-tool",
      "test-tool-id",
      client
    );

    const request: API.ConnectRequest = {
      ...defaultRequest,
      options: {
        tools: {
          services: [
            {
              type: "mcp",
              uri: "test-tool",
              id: "test-tool-id",
              info: toolInfo,
            },
          ],
        },
      },
    };

    const response = await artinetProvider(request);
    expect(response).toBeDefined();
  });

  it("should get tool request from API", async () => {
    const toolInfo: Runtime.ToolInfo = await getToolInfo(
      "test-tool",
      "test-tool-id",
      client
    );

    const request: API.ConnectRequest = {
      ...defaultRequest,
      messages: [
        { role: "user", content: "test-message" },
        { role: "user", content: "use the echo tool" },
      ],
      options: {
        tools: {
          services: [
            {
              type: "mcp",
              uri: "test-tool",
              id: "test-tool-id",
              info: toolInfo,
            },
          ],
        },
      },
    };

    const response = await artinetProvider(request);
    expect(response).toBeDefined();
  });

  it("should send agent card to API", async () => {
    const request: API.ConnectRequest = {
      ...defaultRequest,
      messages: [
        { role: "user", content: "test-message" },
        { role: "user", content: "use the echo skill" },
      ],
      options: {
        agents: {
          services: [
            {
              type: "a2a",
              uri: "test-agent",
              url: "https://test-agent.com",
              id: "test-agent-id",
              info: {
                ...testAgentCard,
                uri: "test-agent",
                id: "test-agent-id",
              },
            },
          ],
        },
      },
    };

    const response = await artinetProvider(request);
    expect(response).toBeDefined();
  });

  it("should execute an agent skill", async () => {
    const echoAgent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });

    const request: API.ConnectRequest = {
      ...defaultRequest,
      messages: [
        { role: "user", content: "test-message" },
        { role: "user", content: "use the echo skill" },
      ],
      options: {
        agents: {
          services: [
            {
              type: "a2a",
              uri: "test-agent",
              url: echoAgent.agentCard.url,
              id: "test-agent-id",
              info: {
                ...echoAgent.agentCard,
                uri: "test-agent",
                id: "test-agent-id",
              },
            },
          ],
        },
      },
    };

    const response = await artinetProvider(request);
    expect(response).toBeDefined();

    // Clean up
    await echoAgent.stop();
  });
});

describe("API Provider Tests (Local)", () => {
  it("should have artinetProvider function", () => {
    expect(artinetProvider).toBeDefined();
    expect(typeof artinetProvider).toBe("function");
  });
});
