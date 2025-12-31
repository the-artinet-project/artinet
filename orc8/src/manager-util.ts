/**
 * @fileoverview
 * Manager utility functions for callable request dispatch.
 *
 * This module provides the core request routing logic for the Manager class,
 * handling the dispatch of requests to appropriate callable implementations
 * based on their type (agent vs tool).
 *
 * Key responsibilities:
 * - Type-safe request dispatch to agents and tools
 * - Error handling and logging for failed calls
 * - Request/response type validation
 *
 * @module manager-util
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import { logger } from "@artinet/sdk";
import * as Callable from "./types.js";

/**
 * Dispatches a request to the appropriate callable implementation.
 *
 * Determines whether the callable is an agent or tool based on its `kind`
 * property, validates that the request type matches, and executes the call.
 *
 * Error handling:
 * - Returns undefined if callable is not found
 * - Returns undefined if request type doesn't match callable type
 * - Catches and logs execution errors, returning undefined
 *
 * @param callable - The agent or tool to execute the request against
 * @param request - The request to execute (agent or tool request)
 * @param options - Execution options including task context and abort signal
 * @returns Promise resolving to the response, or undefined on failure
 *
 * @example
 * ```typescript
 * const response = await request(
 *   myTool,
 *   { kind: "tool_request", uri: "my-tool", call: { name: "action" } },
 *   { parentTaskId: "task-123", tasks: {} }
 * );
 * if (response) {
 *   console.log("Tool result:", response.result);
 * }
 * ```
 */
export async function request(
  callable: Callable.Agent | Callable.Tool,
  request: Callable.Request,
  options: Callable.Options
): Promise<Callable.Response | undefined> {
  if (!callable) {
    logger.warn(`[request:target:${request.uri}]: not found.`);
    return undefined;
  }
  const log = logger.child({
    method: "processRequest",
    target: callable.uri,
  });

  let response: Callable.Response | undefined = undefined;

  if (callable.kind === "agent" && Runtime.isAgentRequest(request)) {
    response = await callable.execute({ request, options }).catch((err) => {
      log.error(`error calling agent: `, err);
      return undefined;
    });
  } else if (callable.kind === "tool" && Runtime.isToolRequest(request)) {
    response = await callable.execute({ request, options }).catch((err) => {
      log.error(`error calling tool: `, err);
      return undefined;
    });
  } else {
    log.warn(`invalid request type: ${request.uri}`);
  }
  return response;
}
