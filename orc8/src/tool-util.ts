/**
 * @fileoverview
 * Tool utility functions for MCP (Model Context Protocol) communication.
 *
 * This module provides low-level utilities for interacting with MCP servers,
 * including client initialization, capability discovery, and tool invocation.
 * Key responsibilities:
 *
 * - Client initialization: Creates and connects MCP clients to transports
 * - Capability discovery: Queries servers for tools, resources, and prompts
 * - Tool invocation: Executes tool calls with proper error handling
 * - Response normalization: Transforms MCP results into standard formats
 * - Stderr streaming: Captures real-time output from tool subprocesses
 *
 * These utilities are typically used internally by the {@link Tool} class
 * but can be accessed directly for advanced MCP integration scenarios.
 *
 * @module tool-util
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { v4 as uuidv4 } from "uuid";
import { Runtime } from "@artinet/types";
import { MCP, logger, formatError, formatJson } from "@artinet/sdk";
import {
  Client as MCPClient,
  ClientOptions as MCPClientOptions,
} from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport as MCPTransport } from "@modelcontextprotocol/sdk/shared/transport.js";
import * as Callable from "./types.js";

/**
 * Initializes an MCP client and connects it to the provided transport.
 *
 * Creates a new MCP client instance with the specified URI as its name,
 * then establishes the connection to the server.
 *
 * @param transport - The MCP transport to connect to (stdio, SSE, etc.)
 * @param uri - The client name/identifier (defaults to a UUID)
 * @param options - Optional MCP client configuration
 * @returns Promise resolving to the connected MCP client
 *
 * @example
 * ```typescript
 * const transport = new StdioClientTransport({ command: "npx", args: [...] });
 * const client = await initClient(transport, "my-tool");
 * ```
 */
export async function initClient(
  transport: MCPTransport,
  uri: string = uuidv4(),
  options?: MCPClientOptions
): Promise<MCPClient> {
  const client = new MCPClient(
    {
      name: uri,
      version: "0.0.1",
    },
    options
  );
  await client.connect(transport);
  return client;
}

/**
 * Retrieves the server capabilities from an MCP client.
 *
 * @param client - The connected MCP client
 * @returns The server's capability descriptor
 * @throws {Error} If capabilities are not available or tools are not supported
 * @internal
 */
function getCapabilities(client: MCPClient): MCP.ServerCapabilities {
  const serverCapabilities: MCP.ServerCapabilities | undefined =
    client.getServerCapabilities();
  if (!serverCapabilities) {
    throw new Error("getCapabilities: Server capabilities not found");
  }
  if (!serverCapabilities.tools) {
    throw new Error("getCapabilities: Server tools not found");
  }
  return serverCapabilities;
}

/**
 * Retrieves the server implementation info (name and version).
 *
 * @param client - The connected MCP client
 * @returns The server's implementation descriptor
 * @throws {Error} If server version info is not available
 * @internal
 */
function getImplementation(client: MCPClient): MCP.Implementation {
  const implementation: MCP.Implementation | undefined =
    client.getServerVersion();
  if (!implementation) {
    throw new Error("getImplementation: Server version not found");
  }
  return implementation;
}

/**
 * Retrieves any instructions provided by the MCP server.
 *
 * @param client - The connected MCP client
 * @returns The server instructions, or undefined if not provided
 * @internal
 */
function getInstructions(client: MCPClient): string | undefined {
  const instructions: string | undefined = client.getInstructions();
  if (!instructions) {
    logger.warn("getInstructions: Server instructions not found");
  }
  return instructions;
}

/**
 * Retrieves all available tools from an MCP server with pagination.
 *
 * Handles cursor-based pagination to retrieve the complete tool list.
 *
 * @param client - The connected MCP client
 * @returns Promise resolving to the array of available tools
 * @throws {Error} If no tools are found on the server
 * @internal
 */
async function getTools(client: MCPClient): Promise<MCP.Tool[]> {
  let nextCursor: string | undefined = undefined;
  const tools: MCP.Tool[] = [];
  do {
    const toolResults: MCP.ListToolsResult = await client
      .listTools({
        cursor: nextCursor,
      })
      .catch((error) => {
        logger.error("getTools: error listing tools: ", error);
        return {
          tools: [],
          nextCursor: undefined,
        };
      });
    tools.push(...toolResults.tools);
    nextCursor = toolResults.nextCursor;
  } while (nextCursor);

  if (!tools || tools.length === 0) {
    throw new Error("getTools: Server tools not found");
  }
  return tools;
}

/**
 * Retrieves all available resources from an MCP server with pagination.
 *
 * @param client - The connected MCP client
 * @returns Promise resolving to the array of available resources (may be empty)
 * @internal
 */
async function getResources(client: MCPClient): Promise<MCP.Resource[]> {
  let nextCursor: string | undefined = undefined;
  const resources: MCP.Resource[] = [];
  nextCursor = undefined;
  do {
    const resourceResults: MCP.ListResourcesResult = await client
      .listResources({
        cursor: nextCursor,
      })
      .catch((error) => {
        logger.error("getResources: error listing resources: ", error);
        return {
          resources: [],
          nextCursor: undefined,
        };
      });
    resources.push(...resourceResults.resources);
    nextCursor = resourceResults.nextCursor;
  } while (nextCursor);
  if (!resources || resources.length === 0) {
    logger.warn("getResources: Server resources not found");
  }
  return resources;
}

/**
 * Retrieves all available prompts from an MCP server with pagination.
 *
 * @param client - The connected MCP client
 * @returns Promise resolving to the array of available prompts (may be empty)
 * @internal
 */
async function getPrompts(client: MCPClient): Promise<MCP.Prompt[]> {
  let nextCursor: string | undefined = undefined;
  const prompts: MCP.Prompt[] = [];
  do {
    const promptResults: MCP.ListPromptsResult = await client
      .listPrompts({
        cursor: nextCursor,
      })
      .catch((error) => {
        logger.error("getPrompts: error listing prompts: ", error);
        return {
          prompts: [],
          nextCursor: undefined,
        };
      });
    prompts.push(...promptResults.prompts);
    nextCursor = promptResults.nextCursor;
  } while (nextCursor);
  if (!prompts || prompts.length === 0) {
    logger.warn("getPrompts: Server prompts not found");
  }
  return prompts;
}

/**
 * Retrieves complete metadata from an MCP server.
 *
 * Gathers all available information about the server including:
 * - Implementation details (name, version)
 * - Server capabilities
 * - Available tools (required)
 * - Available resources (optional)
 * - Available prompts (optional)
 * - Server instructions (optional)
 *
 * @param client - The connected MCP client
 * @returns Promise resolving to the complete tool info
 * @throws {Error} If the client is null or required capabilities are missing
 *
 * @example
 * ```typescript
 * const info = await getToolInfo(client);
 * console.log(`Server: ${info.implementation.name} v${info.implementation.version}`);
 * console.log(`Tools: ${info.tools.map(t => t.name).join(", ")}`);
 * ```
 */
export async function getToolInfo(
  uri: string,
  id: string,
  client: MCPClient
): Promise<Runtime.ToolInfo> {
  if (!client) {
    throw new Error("retrieveMCPInfo: Client not found");
  }
  const serverCapabilities: MCP.ServerCapabilities = getCapabilities(client);
  const implementation: MCP.Implementation = getImplementation(client);
  // Get all tools
  let tools: MCP.Tool[] = [];
  if (serverCapabilities.tools) {
    tools = await getTools(client);
  }

  // Get all resources
  let resources: MCP.Resource[] = [];
  if (serverCapabilities.resources) {
    resources = await getResources(client);
  }

  // Get all prompts
  let prompts: MCP.Prompt[] = [];
  if (serverCapabilities.prompts) {
    prompts = await getPrompts(client);
  }

  const instructions: string | undefined = getInstructions(client);
  const toolInfo: Runtime.ToolInfo = {
    uri,
    id,
    implementation,
    serverCapabilities,
    tools,
    resources,
    prompts,
    instructions,
  };
  return toolInfo;
}

/**
 * Creates a formatted error result for a failed tool call.
 *
 * @param request - The original tool request
 * @param error - The error that occurred
 * @returns An MCP CallToolResult containing the formatted error message
 * @internal
 */
const toolError = (
  request: Runtime.ToolRequest,
  error: unknown
): MCP.CallToolResult => {
  return {
    content: [
      {
        type: "text",
        text: `[tool:${request.uri}]: error calling tool: \ncall: ${formatJson(
          request.call
        )} \nerror: ${formatError(error)}`,
      },
    ],
  } as MCP.CallToolResult;
};

/**
 * Normalizes an MCP result into a standard ToolResponse format.
 *
 * @param uri - The tool's unique identifier
 * @param request - The original tool request
 * @param result - The MCP call result, or null/undefined on failure
 * @param error - Any error that occurred during the call
 * @returns A normalized ToolResponse object
 * @internal
 */
const _response = (
  uri: string,
  request: Runtime.ToolRequest,
  result:
    | MCP.CompatibilityCallToolResult
    | MCP.CallToolResult
    | undefined
    | null,
  error: Error | undefined
): Runtime.ToolResponse => {
  const _result: MCP.CallToolResult =
    MCP.CallToolResultSchema.safeParse(result).data ??
    toolError(request, error);
  const _id = request.id ?? uuidv4();
  return {
    type: "mcp",
    callerId: request.callerId ?? "unknown",
    kind: "tool_response",
    uri: uri,
    call: request.call,
    result: _result,
    content: {
      ..._result,
      type: "tool_result",
      toolUseId: _id,
    },
    error: error,
    id: _id,
  };
};

/**
 * Creates a stderr handler that converts output to tool responses.
 *
 * This enables real-time streaming of tool subprocess output to callbacks,
 * useful for progress updates and verbose logging during long-running operations.
 *
 * @param req - The tool request being executed
 * @param cb - Callback function to receive streamed responses
 * @returns A handler function for stderr data events
 * @internal
 */
const _handler = (
  req: Runtime.ToolRequest,
  cb: Callable.Options["callback"] = (resp: Callable.Response) => {
    logger.warn(`[tool:${resp.uri}]: tool response: ${formatJson(resp)}`);
  }
): ((data: Buffer) => void) => {
  const _id = req.id ?? uuidv4();
  return (data: Buffer) => {
    const resp: Runtime.ToolResponse = {
      type: "mcp",
      call: req.call,
      callerId: req.callerId ?? "unknown",
      uri: req.uri,
      kind: "tool_response",
      result: {
        toolUseId: _id,
        content: [{ type: "text", text: data.toString() }],
      },
      content: {
        type: "tool_result",
        toolUseId: _id,
        content: [{ type: "text", text: data.toString() }],
      },
      error: undefined,
      id: _id,
    };
    cb?.(resp);
  };
};

/**
 * Invokes a tool on an MCP server and returns the response.
 *
 * Handles the complete tool call lifecycle:
 * 1. Sets up stderr streaming for real-time output
 * 2. Executes the tool call via the MCP protocol
 * 3. Captures and normalizes any errors
 * 4. Cleans up stderr listeners
 * 5. Returns a normalized ToolResponse
 *
 * @param client - The MCP client to use for the call
 * @param uri - The tool's unique identifier
 * @param request - The tool request containing the call payload
 * @param options - Execution options with callback and abort signal
 * @returns Promise resolving to the normalized tool response
 *
 * @example
 * ```typescript
 * const response = await callTool(client, "filesystem", {
 *   kind: "tool_request",
 *   uri: "filesystem",
 *   call: { name: "read_file", arguments: { path: "/tmp/test.txt" } }
 * }, {
 *   parentTaskId: "parent-123",
 *   tasks: { "parent-123": {} },
 *   callback: (resp) => console.log("Streaming:", resp)
 * });
 * ```
 */
export async function callTool(
  client: MCPClient,
  uri: string,
  request: Runtime.ToolRequest,
  options: Callable.Options
): Promise<Runtime.ToolResponse> {
  let _error: Error | undefined = undefined;
  const handle = _handler(request, options.callback);

  (client.transport as StdioClientTransport)?.stderr?.on("data", handle);

  const result:
    | MCP.CompatibilityCallToolResult
    | MCP.CallToolResult
    | undefined = await client
    .callTool(request.call, undefined, {
      signal: options.abortSignal,
    })
    .catch((error) => {
      logger.error(`[target:${uri}:${request.id}]: tool error: `, error);
      _error = error as Error;
      return undefined;
    });

  (client.transport as StdioClientTransport)?.stderr?.off("data", handle);
  return _response(uri, request, result, _error);
}
