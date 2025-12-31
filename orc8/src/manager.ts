/**
 * @fileoverview
 * Callable service manager for orchestrating agents and tools.
 *
 * This module provides the Manager class which extends the base SDK Manager
 * to handle concurrent execution of callable services (agents and tools).
 * Key responsibilities:
 *
 * - Service registry: Stores and retrieves callable services by URI
 * - Concurrent execution: Processes multiple requests with controlled parallelism
 * - Request routing: Dispatches requests to appropriate service implementations
 * - Lifecycle management: Handles graceful shutdown of all registered services
 *
 * The Manager serves as the foundation for the {@link Model} class, providing
 * the core callable management infrastructure.
 *
 * @example
 * ```typescript
 * class MyOrchestrator extends Manager {
 *   async process(requests: Callable.Request[]) {
 *     return await this.call({
 *       request: requests,
 *       options: { parentTaskId: "task-123", tasks: {} }
 *     });
 *   }
 * }
 * ```
 *
 * @module manager
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Manager as BaseManager } from "@artinet/sdk";
import pLimit from "p-limit";
import { logger } from "@artinet/sdk";
import * as Callable from "./types.js";
import * as Util from "./manager-util.js";

/** Function type for the request dispatch implementation. */
type requestFn = typeof Util.request;

/**
 * Service manager for callable agents and tools.
 *
 * Extends the base SDK Manager to provide specialized handling for
 * orchestrator callables, including concurrent execution with rate limiting
 * and graceful service shutdown.
 *
 * @extends {BaseManager<Callable.Agent | Callable.Tool>}
 *
 * @example
 * ```typescript
 * const manager = new Manager(new Map([["agent-1", myAgent]]));
 * const responses = await manager.call({
 *   request: [{ kind: "agent_request", uri: "agent-1", call: "Hello" }],
 *   options: { parentTaskId: "task", tasks: {} }
 * });
 * ```
 */
export class Manager extends BaseManager<Callable.Agent | Callable.Tool> {
  /** Bound reference to the request dispatch utility function. */
  protected _request: requestFn = Util.request.bind(this);

  /**
   * The number of registered callable services.
   */
  get count(): number {
    return this.data.size;
  }

  /**
   * Array of all registered service URIs.
   */
  get uris(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Array of all registered callable service instances.
   */
  get values(): (Callable.Agent | Callable.Tool)[] {
    return Array.from(this.data.values());
  }

  /**
   * Gracefully stops all registered services.
   *
   * Iterates through all callables and invokes their stop methods
   * in parallel, waiting for all to complete.
   */
  async stop(): Promise<void> {
    await Promise.all((await this.list())?.map((value) => value.stop()));
  }

  /**
   * Processes a single callable request.
   *
   * Looks up the callable by URI and delegates execution to the
   * appropriate implementation.
   *
   * @param request - The callable request to process
   * @param options - Execution options including task context
   * @returns Promise resolving to the response, or undefined if callable not found
   * @protected
   */
  protected async _processRequest(
    request: Callable.Request,
    options: Callable.Options
  ): Promise<Callable.Response | undefined> {
    const callable = await this.get(request.uri);
    if (!callable) {
      logger.warn(`[processRequest:target:${request.uri}]: not found.`);
      return undefined;
    }
    return await this._request(callable, request, options);
  }

  /**
   * Executes multiple callable requests with controlled concurrency.
   *
   * Processes requests in parallel with a concurrency limit defined by
   * {@link Callable.DEFAULT_CONCURRENCY}. Errors on individual requests
   * are logged but don't fail the entire batch.
   *
   * @param request - Array of callable requests to execute
   * @param options - Execution options shared across all requests
   * @returns Promise resolving to array of successful responses
   *
   * @example
   * ```typescript
   * const responses = await manager.call({
   *   request: [
   *     { kind: "tool_request", uri: "tool-1", call: { name: "action1" } },
   *     { kind: "agent_request", uri: "agent-1", call: "Do something" }
   *   ],
   *   options: { parentTaskId: "parent", tasks: {} }
   * });
   * ```
   */
  async call({
    request,
    options,
  }: {
    request: Callable.Request[];
    options: Callable.Options;
  }): Promise<Callable.Response[]> {
    if (request.length === 0) {
      return [];
    }
    const responses: Callable.Response[] = [];
    const limit = pLimit(
      Math.min(Callable.DEFAULT_CONCURRENCY, request.length)
    );
    await Promise.allSettled(
      request.map((req) => {
        return limit(async () => {
          const result = await this._processRequest(req, options).catch(
            (err) => {
              logger.error(
                `[Manager:execute:callable:${req.uri}]: error processing request: `,
                err
              );
              return undefined;
            }
          );
          if (result) {
            responses.push(result);
          }
          return;
        });
      })
    );
    return responses;
  }
}
