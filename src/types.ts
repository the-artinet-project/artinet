/**
 * @fileoverview
 * Core type definitions for the orchestrator's callable service system.
 *
 * This module defines the foundational types and interfaces for the orchestrator's
 * callable abstraction layer. It provides a unified type system for both
 * A2A agents and MCP tools, enabling the orchestrator to treat them polymorphically.
 *
 * Key concepts:
 * - **Callable**: A service (agent or tool) that can be dynamically invoked
 * - **Options**: Execution context including task tracking and cancellation
 * - **Bundle**: Type-level mapping between call types and their associated types
 * - **Instance**: The unified interface all callables must implement
 *
 * @example
 * ```typescript
 * // Using callable types
 * function processResponses(responses: Callable.Response[]) {
 *   for (const response of responses) {
 *     if (response.kind === "agent_response") {
 *       console.log("Agent said:", response.result);
 *     } else {
 *       console.log("Tool returned:", response.result.content);
 *     }
 *   }
 * }
 * ```
 *
 * @module types
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import { core } from "@artinet/sdk";
import { z } from "zod/v4";

/**
 * Default maximum concurrent callable executions.
 * Can be overridden via the `DEFAULT_CONCURRENCY` environment variable.
 * @default 10
 */
export const DEFAULT_CONCURRENCY = process.env.DEFAULT_CONCURRENCY
  ? parseInt(process.env.DEFAULT_CONCURRENCY)
  : 10;

/**
 * Default maximum iterations for the reactive agentic loop.
 * Limits how many times the orchestrator can call agents/tools per request.
 * Can be overridden via the `DEFAULT_ITERATIONS` environment variable.
 * @default 10
 */
export const DEFAULT_ITERATIONS = process.env.DEFAULT_ITERATIONS
  ? parseInt(process.env.DEFAULT_ITERATIONS)
  : 10;

/**
 * Union type representing valid callable invocation types.
 * Either an agent call (A2A message) or a tool call (MCP tool invocation).
 */
export const CallsSchema = z.discriminatedUnion("type", [
  Runtime.AgentCallSchema,
  Runtime.ToolCallSchema,
]);
export type Calls = z.input<typeof CallsSchema>;
/**
 * Type-level bundle that maps a call type to its associated types.
 *
 * This conditional type mapping enables the orchestrator to maintain
 * type safety when working with either agents or tools polymorphically.
 *
 * @typeParam Call - The call type (AgentCall or ToolCall)
 * @typeParam Options - The options type for execution configuration
 * @internal
 */
interface Bundle<Call extends Calls, Options extends object> {
  /** The call payload type. */
  call: Call;
  /** The corresponding request type. */
  request: Call extends Runtime.AgentCall
    ? Runtime.AgentRequest
    : Runtime.ToolRequest;
  /** The execution options type. */
  options: Options;
  /** The corresponding response type. */
  response: Call extends Runtime.AgentCall
    ? Runtime.AgentResponse
    : Runtime.ToolResponse;
  /** The corresponding info/metadata type. */
  info: Call extends Runtime.AgentCall ? Runtime.AgentInfo : Runtime.ToolInfo;
  /** The corresponding service descriptor type. */
  target: Call extends Runtime.AgentCall
    ? Runtime.AgentService
    : Runtime.ToolService;
}

/**
 * Execution options for callable invocations.
 *
 * Provides the context needed for proper request processing,
 * including task correlation, concurrency limits, and cancellation support.
 */
export interface Options {
  /**
   * The parent task ID for correlating child tasks.
   * Used to maintain context across multi-agent interactions.
   */
  parentTaskId: string;

  /**
   * Task state map for session tracking.
   * Maps parent task IDs to child task IDs per service URI.
   */
  tasks: Record<string, Record<string, string>>;

  /**
   * Maximum number of agentic loop iterations.
   * Overrides {@link DEFAULT_ITERATIONS} when specified.
   */
  iterations?: number;

  /**
   * Signal for cancelling in-flight operations.
   * Connected to the parent AbortController.
   */
  abortSignal?: AbortSignal;

  /**
   * Callback for receiving real-time response updates.
   * Called for each tool/agent response during execution.
   */
  callback?: (response: Response) => void;
}

/**
 * Base interface for callable service instances.
 *
 * Defines the contract that all callable services (agents and tools) must
 * implement to be managed by the orchestrator. Extends the core Service
 * interface for standardized request/response handling.
 *
 * @typeParam Call - The call type (AgentCall or ToolCall)
 * @typeParam Options - The options type for execution configuration
 */
export interface Instance<Call extends Calls, Options extends object>
  extends core.Service<
    {
      request: Bundle<Call, Options>["request"];
      options: Bundle<Call, Options>["options"];
    },
    Bundle<Call, Options>["response"]
  > {
  /**
   * Unique identifier for this callable within the orchestrator.
   */
  uri: string;

  /**
   * Discriminator property identifying the callable type.
   */
  readonly kind: Call extends Runtime.AgentCall ? "agent" : "tool";

  /**
   * Cached metadata for the callable (may be undefined until loaded).
   */
  info: Bundle<Call, Options>["info"] | undefined;

  /**
   * Retrieves the full metadata for this callable.
   * @returns Promise resolving to the callable's info
   */
  getInfo(): Promise<Bundle<Call, Options>["info"]>;

  /**
   * Builds a service descriptor for this callable.
   * @returns Promise resolving to the service descriptor
   */
  getTarget(): Promise<Bundle<Call, Options>["target"]>;
}

/**
 * Interface for A2A agent callables.
 * Specialized instance type for agent-specific operations.
 */
export interface Agent extends Instance<Runtime.AgentCall, Options> {}

/**
 * Interface for MCP tool callables.
 * Specialized instance type for tool-specific operations.
 */
export interface Tool extends Instance<Runtime.ToolCall, Options> {}

/**
 * Union type for all valid callable request types.
 */
export type Request = Runtime.AgentRequest | Runtime.ToolRequest;

/**
 * Union type for all valid callable response types.
 */
export type Response = Runtime.AgentResponse | Runtime.ToolResponse;
