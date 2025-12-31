/**
 * @fileoverview
 * Safe MCP transport management utilities.
 *
 * This module provides utilities for safely creating and closing MCP stdio
 * transports, with proper cleanup of subprocess resources to prevent
 * resource leaks and orphaned processes.
 *
 * Key features:
 * - Safe transport creation with stderr piping for error capture
 * - Comprehensive cleanup of all streams and listeners
 * - Graceful client/transport closure with SIGKILL fallback
 * - Error-resilient shutdown that never throws
 *
 * @example
 * ```typescript
 * // Create a safe transport
 * const transport = safeStdioTransport({
 *   command: "npx",
 *   args: ["-y", "@mcp/server"]
 * });
 *
 * // ... use the transport ...
 *
 * // Clean up when done
 * await safeClose(client, transport);
 * ```
 *
 * @module utils/safeTransport
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "@artinet/sdk";

/**
 * Safely closes an MCP client and its underlying stdio transport.
 *
 * Performs comprehensive cleanup:
 * 1. Removes all event listeners from stdin/stdout/stderr
 * 2. Destroys all stream objects
 * 3. Unpipes any piped streams
 * 4. Closes the transport and client connections
 * 5. Kills the subprocess with SIGKILL as a last resort
 *
 * All operations are wrapped in try/catch to ensure the function
 * never throws, even if individual cleanup steps fail.
 *
 * @param client - The MCP client to close
 * @param transport - The stdio transport managing the subprocess
 *
 * @example
 * ```typescript
 * // Always call safeClose when done with a tool
 * try {
 *   const result = await tool.execute(request);
 * } finally {
 *   await safeClose(client, transport);
 * }
 * ```
 */
export async function safeClose(
  client: Client,
  transport: StdioClientTransport
) {
  if (!client || !transport) {
    return;
  }
  try {
    const pid = transport.pid;
    const childProcess = (transport as any)._process;
    if (childProcess) {
      // Remove all listeners from streams
      childProcess.stdin?.removeAllListeners();
      childProcess.stdout?.removeAllListeners();
      childProcess.stderr?.removeAllListeners();

      // Destroy the streams
      childProcess.stdin?.destroy();
      childProcess.stdout?.destroy();
      childProcess.stderr?.destroy();

      // Unpipe stderr if it was piped
      childProcess.stderr?.unpipe();
    }
    await transport.close().catch((_) => {});
    await client.close().catch((_) => {});
    if (pid) {
      await process.kill(pid, "SIGKILL");
    }
    transport.stderr?.removeAllListeners();
  } catch (error) {
    logger.error("error closing transport: ", error);
  }
}

/**
 * Creates a stdio transport with safe defaults.
 *
 * Ensures stderr is piped (not inherited) to enable error capture
 * and monitoring during tool execution.
 *
 * @param transportParams - The stdio server parameters
 * @returns A configured StdioClientTransport instance
 *
 * @example
 * ```typescript
 * const transport = safeStdioTransport({
 *   command: "npx",
 *   args: ["-y", "@mcp/server-filesystem", "/tmp"],
 *   env: { NODE_ENV: "production" }
 * });
 * ```
 */
export function safeStdioTransport(transportParams: StdioServerParameters) {
  return new StdioClientTransport({
    ...transportParams,
    stderr: transportParams.stderr ?? "pipe",
  });
}
