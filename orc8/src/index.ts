/**
 * @fileoverview
 * @artinet/orchestrator - Dynamic AI Agent Orchestration Library
 *
 * This module serves as the primary entry point for the Artinet Orchestrator,
 * a production-grade library for dynamically routing messages between A2A
 * (Agent-to-Agent) enabled AI agents and marshalling MCP (Model Context Protocol)
 * tool servers.
 *
 * @description
 * The orchestrator enables:
 * - Dynamic message dispatch between multiple AI agents
 * - Automatic tool integration with concurrent execution via MCP
 * - Persistent session management with message history
 * - Task handoff and context chaining using A2A reference tasks
 *
 * @example
 * ```typescript
 * import { create } from "@artinet/orchestrator";
 *
 * const model = create({ modelId: "gpt-4" });
 * model.add({ command: "npx", args: ["-y", "@mcp/server-filesystem", "/tmp"] });
 *
 * const response = await model.connect("List files in /tmp");
 * ```
 *
 * @packageDocumentation
 * @module @artinet/orchestrator
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Model class exported as `orc8`.
 * Prefer using `orc8.create()` factory function for new implementations.
 */
export {
  Model as orc8,
  type CreateModelParams as Orc8Params,
} from "./model.js";

/**
 * Factory function for creating new Model instances with type-safe parameters.
 * @see {@link Params} for configuration options
 */
export type { Params } from "./model.js";

/**
 * Type definition for custom API providers.
 * Implement this interface to integrate your own LLM backend.
 */
export type { APIProvider } from "./model-util.js";

/**
 * Utility function for extracting conversation history from A2A tasks.
 * Useful for maintaining context across agent interactions.
 */
export { getHistory } from "./utils/history.js";

/**
 * Safe transport utilities for MCP stdio connections.
 * Handles proper cleanup and error recovery for subprocess management.
 */
export { safeStdioTransport, safeClose } from "./utils/safeTransport.js";
