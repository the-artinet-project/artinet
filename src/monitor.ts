/**
 * @fileoverview
 * Centralized event monitoring for orchestrator activities.
 *
 * This module provides the Monitor class, a specialized context manager that
 * acts as a centralized event bus for the orchestrator. It aggregates events
 * from all registered contexts and provides a unified subscription interface.
 *
 * Key features:
 * - Centralized event aggregation from all A2A contexts
 * - Real-time update emissions for agent/tool responses
 * - Error event propagation with task context
 * - Full A2A.Contexts interface implementation for seamless integration
 *
 * @example
 * ```typescript
 * const monitor = new Monitor();
 *
 * // Subscribe to all orchestrator updates
 * monitor.on("update", (data, update) => {
 *   if (typeof data === "string") {
 *     console.log("Status:", data);
 *   } else if ("kind" in data) {
 *     console.log(`${data.kind} from ${data.uri}:`, data.result);
 *   }
 * });
 *
 * // Subscribe to errors
 * monitor.on("error", (error, task) => {
 *   console.error(`Error in task ${task.id}:`, error);
 * });
 * ```
 *
 * @module monitor
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { A2A, Contexts } from "@artinet/sdk";
import { EventEmitter } from "events";
import { Runtime } from "@artinet/types";

/**
 * Centralized event bus and context manager for the orchestrator.
 *
 * Extends EventEmitter to provide typed event subscriptions for orchestrator
 * activities. Implements the A2A.Contexts interface for seamless integration
 * with A2A agents and services.
 *
 * Events:
 * - `update`: Emitted when any agent/tool responds or context updates
 * - `error`: Emitted when an error occurs during task processing
 *
 * @extends {EventEmitter}
 * @implements {A2A.Contexts}
 *
 * @example
 * ```typescript
 * const monitor = new Monitor();
 *
 * monitor.on("update", (data, update) => {
 *   console.log("Orchestrator update:", data);
 * });
 *
 * // Use with Model
 * const model = create({
 *   modelId: "gpt-4",
 *   events: monitor
 * });
 * ```
 */
export class Monitor
  extends EventEmitter<
    Pick<A2A.Emissions, "error"> & {
      update: [
        A2A.Task | Runtime.AgentResponse | Runtime.ToolResponse | string,
        A2A.Update | undefined
      ];
    }
  >
  implements A2A.Contexts
{
  /** Internal contexts manager for A2A context lifecycle. */
  private contexts: Contexts;

  /**
   * Creates a new Monitor instance.
   *
   * @param contexts - Optional pre-populated context map for initialization
   */
  constructor(contexts: Map<string, A2A.Context> = new Map()) {
    super();
    this.contexts = new Contexts(contexts);
  }

  /**
   * Internal handler for context update events.
   * Re-emits updates through the centralized monitor.
   * @internal
   */
  private emitUpdate = (
    state: A2A.Task | Runtime.AgentResponse | Runtime.ToolResponse | string,
    update: A2A.Update | undefined
  ): void => {
    this.emit("update", state, update);
  };

  /**
   * Internal handler for context error events.
   * Re-emits errors through the centralized monitor.
   * @internal
   */
  private emitError = (error: any, state: A2A.Task): void => {
    if (!this.listenerCount("error")) return;
    this.emit("error", error, state);
  };

  /**
   * Registers event listeners on a context for centralized monitoring.
   *
   * @param context - The context to register
   * @protected
   */
  protected _registerContext(context: A2A.Context): void {
    context.publisher.on("update", this.emitUpdate.bind(this));
    context.publisher.on("error", this.emitError.bind(this));
  }

  /**
   * Removes event listeners from a context.
   *
   * @param context - The context to unregister
   * @protected
   */
  protected _unregisterContext(context: A2A.Context): void {
    context.publisher.removeListener("update", this.emitUpdate.bind(this));
    context.publisher.removeListener("error", this.emitError.bind(this));
  }

  /**
   * Deletes a context and removes its event listeners.
   *
   * @param id - The context ID to delete
   */
  async delete(id: string): Promise<void> {
    const context = await this.contexts.get(id);
    if (context) {
      this._unregisterContext(context);
    }
    await this.contexts.delete(id);
  }

  /**
   * Creates a new context and registers it for monitoring.
   *
   * @param params - Parameters for context creation
   * @returns Promise resolving to the created context
   */
  async create(params: A2A.ContextParams): Promise<A2A.Context> {
    const context = await this.contexts.create(params);
    this._registerContext(context);
    return context;
  }

  /**
   * Retrieves a context by ID.
   *
   * @param id - The context ID to look up
   * @returns Promise resolving to the context if found
   */
  async get(id: string): Promise<A2A.Context | undefined> {
    return this.contexts.get(id);
  }

  /**
   * Lists all registered contexts.
   *
   * @returns Promise resolving to array of all contexts
   */
  async list(): Promise<A2A.Context[]> {
    return this.contexts.list();
  }

  /**
   * Checks if a context exists by ID.
   *
   * @param id - The context ID to check
   * @returns Promise resolving to true if context exists
   */
  async has(id: string): Promise<boolean> {
    return this.contexts.has(id);
  }

  /**
   * Sets or updates a context by ID.
   *
   * @param id - The context ID
   * @param context - The context to set, or undefined to remove
   */
  async set(id: string, context?: A2A.Context): Promise<void> {
    if (!context) {
      throw new Error("Context is required");
    }

    if (await this.contexts.has(id)) {
      this._unregisterContext((await this.contexts.get(id))!);
    }

    this._registerContext(context);
    this.contexts.set(id, context);
  }
}
