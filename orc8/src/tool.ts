/**
 * @fileoverview
 * Tool wrapper class for MCP (Model Context Protocol) server integration.
 *
 * This module provides a unified interface for managing MCP tool servers,
 * enabling seamless integration with the orchestrator's callable service pattern.
 * The Tool class handles:
 *
 * - Spawning and managing MCP server subprocesses via stdio transport
 * - Lazy-loading tool metadata (capabilities, available tools, resources, prompts)
 * - Request execution with proper error handling and stderr monitoring
 * - Graceful shutdown and cleanup of subprocess resources
 *
 * @example
 * ```typescript
 * // Create a new tool from stdio server parameters
 * const tool = await Tool.create({
 *   command: "npx",
 *   args: ["-y", "@mcp/server-filesystem", "/path/to/files"]
 * }, "filesystem");
 *
 * // Execute a tool request
 * const response = await tool.execute({
 *   request: {
 *     kind: "tool_request",
 *     uri: "filesystem",
 *     call: { name: "list_directory", arguments: { path: "/tmp" } }
 *   },
 * });
 *
 * // Clean up
 * await tool.stop();
 * ```
 *
 * @module tool
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { v4 as uuidv4 } from "uuid";
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioServerParameters,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport as MCPTransport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { safeStdioTransport, safeClose } from "./utils/safeTransport.js";
import { envArgsCapture } from "./utils/env-expand.js";
import { core, logger } from "@artinet/sdk";
import * as Utils from "./tool-util.js";

/** Function type for the tool call implementation. */
type implFn = typeof Utils.callTool;

/**
 * Represents a service execution request for a tool.
 */
type ServiceRequest = {
  /** The tool request containing the call payload. */
  request: Runtime.ToolRequest;
  /** Execution options including task context and abort signal. */
  options: Callable.Options;
};

/**
 * Wrapper class for MCP tool servers.
 *
 * Provides a standardized callable interface for MCP tool servers,
 * handling the complexity of subprocess management, protocol communication,
 * and resource cleanup. This abstraction allows the orchestrator to treat
 * all tools uniformly regardless of their underlying implementation.
 *
 * @implements {Callable.Tool}
 * @implements {core.Service<ServiceRequest, Runtime.ToolResponse>}
 *
 * @example
 * ```typescript
 * const tool = await Tool.create({ command: "npx", args: ["-y", "@mcp/server"] });
 * const info = await tool.getInfo();
 * console.log(`Tool: ${info.implementation.name} with ${info.tools.length} tools`);
 * ```
 */
export class Tool
  implements Callable.Tool, core.Service<ServiceRequest, Runtime.ToolResponse>
{
  /**
   * Creates a new Tool wrapper instance.
   * Use the static factory methods {@link Tool.create} or {@link Tool.from}.
   *
   * @param _client - The MCP client for protocol communication
   * @param _transport - The stdio transport managing the subprocess
   * @param _uri - Unique identifier for this tool in the orchestrator
   * @param _id - Internal instance ID for tracking
   */
  protected constructor(
    private readonly _client: MCPClient,
    private readonly _transport: MCPTransport,
    private readonly _uri: string,
    private readonly _id: string = uuidv4()
  ) {}

  /** Discriminator property identifying this as a tool callable. */
  readonly kind: "tool" = "tool" as const;

  /** Cached tool info, populated lazily on first access. */
  private _info: Runtime.ToolInfo | undefined = undefined;
  /** Promise resolving to the tool info. avoid multiple calls to getInfo. */
  private _infoPromise: Promise<Runtime.ToolInfo> | undefined = undefined;

  /**
   * Tool metadata including implementation info, capabilities, and available tools.
   * Triggers async loading on first access if not already cached.
   * @returns The cached tool info or undefined if still loading
   */
  get info(): Runtime.ToolInfo | undefined {
    if (!this._info) {
      this.getInfo();
    }
    return this._info;
  }

  /**
   * The unique URI identifier for this tool within the orchestrator.
   */
  get uri(): string {
    return this._uri;
  }

  /**
   * The underlying MCP client for direct protocol access.
   */
  get tool(): MCPClient {
    return this._client;
  }

  /** Bound implementation function for tool calls. */
  protected _impl: implFn = Utils.callTool.bind(this);

  /**
   * Retrieves the full tool info, fetching from the MCP server if not cached.
   *
   * The info includes:
   * - Implementation details (name, version)
   * - Server capabilities
   * - Available tools, resources, and prompts
   * - Server instructions
   *
   * @returns Promise resolving to the tool's complete metadata
   */
  async getInfo(): Promise<Runtime.ToolInfo> {
    if (this._info) {
      return this._info;
    }
    if (!this._infoPromise) {
      this._infoPromise = Utils.getToolInfo(this._uri, this._id, this._client);
    }
    /*Probably overkill, but would like to avoid setting _info to undefined if the promise is rejected */
    this._info = (await this._infoPromise) ?? this._info;
    this._infoPromise = undefined;
    return this._info;
  }

  /**
   * Builds a service descriptor for this tool.
   * Used by the orchestrator to expose tool capabilities to the LLM.
   *
   * @returns Promise resolving to a ToolService descriptor
   */
  async getTarget(): Promise<Runtime.ToolService> {
    const info = await this.getInfo();
    return {
      type: "mcp",
      uri: this._uri,
      id: this._id,
      info: info,
    };
  }

  /**
   * Executes a tool request through the MCP protocol.
   *
   * Validates that the request URI matches this tool's URI,
   * then delegates to the underlying implementation.
   *
   * @param request - The tool request containing the call payload
   * @param options - Execution options with task context and abort signal
   * @returns Promise resolving to the tool's response
   * @throws {Error} If the request URI doesn't match this tool's URI
   */
  async execute({
    request,
    options,
  }: ServiceRequest): Promise<Runtime.ToolResponse> {
    if (request.uri !== this.uri) {
      throw new Error(`Invalid request URI: ${request.uri} !== ${this.uri}`);
    }
    return await this._impl(this.tool, this.uri, request, options);
  }

  /**
   * Gracefully stops the tool and releases all resources.
   *
   * This method:
   * - Removes all stream listeners
   * - Destroys stdin/stdout/stderr streams
   * - Closes the MCP client and transport
   * - Kills the subprocess
   */
  async stop(): Promise<void> {
    await safeClose(this._client, this._transport as StdioClientTransport);
  }

  /**
   * Creates a new Tool by spawning an MCP server subprocess.
   *
   * This is the primary factory method for creating tools. It:
   * - Expands environment variables in command arguments
   * - Creates a safe stdio transport with stderr piping
   * - Monitors stderr for initialization errors
   * - Initializes the MCP client connection
   *
   * @param params - Stdio server parameters (command, args, env, etc.)
   * @param uri - Optional unique URI for the tool (auto-generated if omitted)
   * @returns Promise resolving to a new Tool instance
   *
   * @example
   * ```typescript
   * const tool = await Tool.create({
   *   command: "npx",
   *   args: ["-y", "@mcp/server-filesystem", "$HOME/documents"]
   * }, "filesystem");
   * ```
   */
  static async create(
    params: StdioServerParameters,
    uri: string = uuidv4()
  ): Promise<Tool> {
    const transport = safeStdioTransport({
      ...params,
      args: envArgsCapture(params.args ?? []),
    });
    // Monitor the error stream for updates during initialization
    const handle = (data: Buffer) =>
      logger.info(`[${uri}]: tool update: `, data.toString());

    (transport as StdioClientTransport)?.stderr?.on("data", handle);
    const client = await Utils.initClient(transport, uri);
    const tool = Tool.from(client, transport, uri);
    (transport as StdioClientTransport)?.stderr?.off("data", handle);
    return tool;
  }

  /**
   * Wraps an existing MCP client and transport in a Tool instance.
   *
   * Use this when you have already established an MCP connection
   * and want to integrate it with the orchestrator.
   *
   * @param client - The MCP client instance
   * @param transport - The MCP transport instance
   * @param uri - Optional unique URI for the tool (auto-generated if omitted)
   * @returns A new Tool wrapper instance
   */
  static from(
    client: MCPClient,
    transport: MCPTransport,
    uri: string = uuidv4()
  ): Tool {
    const _tool = new Tool(client, transport, uri);
    _tool.getInfo();
    return _tool;
  }
}
