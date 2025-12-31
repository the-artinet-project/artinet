/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 *
 * NOTE: These tests require the MCP server (@modelcontextprotocol/server-everything)
 * to run correctly. The server has compatibility issues with some Node.js versions.
 *
 * If tests fail with "Connection closed" errors, it's likely due to:
 * 1. Node.js version incompatibility with the MCP server
 * 2. Jest's parallel execution spawning issues
 *
 * Requirements:
 * - Node.js 20+ is recommended for MCP server compatibility
 * - Run with --runInBand for more reliable results
 */
import { jest, describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Runtime } from "@artinet/types";
import { Tool } from "../src/tool.js";
import { initClient, getToolInfo } from "../src/tool-util.js";
import { safeStdioTransport, safeClose } from "../src/utils/safeTransport.js";

jest.setTimeout(60000);

const serverEverythingConfig: StdioServerParameters = {
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-everything@2025.11.25"],
};

describe("Tool Tests", () => {
  let client: MCPClient;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    try {
      transport = safeStdioTransport(serverEverythingConfig);
      client = await initClient(transport, "test-client");
    } catch (error) {
      console.warn("MCP server not available:", (error as Error).message);
    }
  });
  afterAll(async () => {
    if (client && transport) {
      await safeClose(client, transport);
    }
  });
  describe("initClient and getToolInfo", () => {
    it("should initialize an MCP client", async () => {
      expect(client).toBeDefined();
    });

    it("should get tool info from client", async () => {
      const toolInfo: Runtime.ToolInfo = await getToolInfo(
        "test-tool",
        "test-tool-id",
        client
      );

      expect(toolInfo).toBeDefined();
      expect(toolInfo.implementation.name).toBe("example-servers/everything");
      expect(toolInfo.serverCapabilities).toBeDefined();
      expect(toolInfo.serverCapabilities.tools).toBeDefined();
      expect(toolInfo.tools).toBeDefined();
      expect(toolInfo.tools?.length).toBeGreaterThan(0);
    });
  });

  describe("Tool class", () => {
    let tool: Tool;

    beforeAll(async () => {
      try {
        tool = await Tool.create(serverEverythingConfig, "test-tool-uri");
      } catch (error) {
        console.warn("Failed to create tool:", (error as Error).message);
      }
    });

    afterAll(async () => {
      if (tool) {
        await tool.stop();
      }
    });

    it("should create a tool from StdioServerParameters", async () => {
      expect(tool).toBeDefined();
      expect(tool.kind).toBe("tool");
      expect(tool.uri).toBe("test-tool-uri");
    });

    it("should have tool info after creation", async () => {
      const info = await tool.getInfo();
      expect(info).toBeDefined();
      expect(info.implementation.name).toBe("example-servers/everything");
      expect(info.tools?.length).toBeGreaterThan(1);
    });

    it("should return tool service target", async () => {
      const target = await tool.getTarget();

      expect(target).toBeDefined();
      expect(target.type).toBe("mcp");
      expect(target.uri).toBe("test-tool-uri");
      expect(target.info).toBeDefined();
    });

    it("should execute a tool request", async () => {
      const request: Runtime.ToolRequest = {
        type: "mcp",
        kind: "tool_request",
        uri: "test-tool-uri",
        call: {
          name: "echo",
          arguments: {
            message: "Hello, Tool!",
          },
        },
        id: "test-request-id",
      };

      const response = await tool.execute({
        request,
        options: {
          parentTaskId: "test-task-id",
          tasks: {},
        },
      });

      expect(response).toBeDefined();
      expect(response.kind).toBe("tool_response");
      expect(response.uri).toBe("test-tool-uri");
      expect(response.result).toBeDefined();
      expect(response.result?.content).toBeDefined();
      expect(response.result?.content?.length).toBeGreaterThan(0);
      expect(response.result?.content?.[0]).toEqual({
        type: "text",
        text: "Echo: Hello, Tool!",
      });
    });

    it("should throw error for mismatched URI", async () => {
      const request: Runtime.ToolRequest = {
        type: "mcp",
        kind: "tool_request",
        uri: "wrong-uri",
        call: {
          name: "echo",
          arguments: { message: "test" },
        },
        id: "test-request-id",
      };

      await expect(
        tool.execute({
          request,
          options: {
            parentTaskId: "test-task-id",
            tasks: {},
          },
        })
      ).rejects.toThrow("Invalid request URI");
    });

    describe("Tool.from", () => {
      it("should create a tool from an existing client and transport", async () => {
        const tool = Tool.from(client, transport, "from-tool-uri");
        expect(tool).toBeDefined();
        expect(tool.kind).toBe("tool");
        expect(tool.uri).toBe("from-tool-uri");
      });
    });
  });
});
