/**
 * @fileoverview
 * Agent wrapper class for A2A (Agent-to-Agent) protocol integration.
 *
 * This module provides a unified interface for wrapping A2A agents and clients,
 * enabling seamless integration with the orchestrator's callable service pattern.
 * The Agent class handles:
 *
 * - Wrapping both local agents and remote A2A clients
 * - Lazy-loading agent metadata (agent cards)
 * - Request execution with session management
 * - Graceful shutdown of agent resources
 *
 * @example
 * ```typescript
 * // Create from existing agent
 * const agent = Agent.from(myA2AAgent, "my-agent-uri");
 *
 * // Create from agent parameters
 * const agent = Agent.create({
 *   engine: myEngine,
 *   agentCard: myCard
 * }, "custom-uri");
 *
 * // Execute a request
 * const response = await agent.execute({
 *   request: { uri: "my-agent-uri", call: "Hello!" },
 *   options: { parentTaskId: "task-123", tasks: {} }
 * });
 * ```
 *
 * @module agent
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Agent as A2Agent,
  AgentMessenger,
  CreateAgentParams,
  createAgent,
} from "@artinet/sdk";
import { Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { v4 as uuidv4 } from "uuid";
import * as Utils from "./agent-util.js";

/** Function type for the agent call implementation. */
type implFn = typeof Utils.callAgent;

/**
 * @internal
 * Wrapper class for A2A-compatible agents.
 *
 * Provides a standardized callable interface for both local A2A agents
 * and remote A2A clients. This abstraction allows the orchestrator to
 * treat all agents uniformly regardless of their underlying implementation.
 *
 * @implements {Callable.Agent}
 *
 * @example
 * ```typescript
 * const agent = Agent.from(existingAgent);
 * const info = await agent.getInfo();
 * console.log(`Agent: ${info.name} - ${info.description}`);
 * ```
 */
export class Agent implements Callable.Agent {
  /**
   * Creates a new Agent wrapper instance.
   * Use the static factory methods {@link Agent.create} or {@link Agent.from}.
   *
   * @param _agent - The underlying A2A agent or client
   * @param _uri - Unique identifier for this agent in the orchestrator
   * @param _id - Internal instance ID for tracking
   */
  protected constructor(
    private readonly _agent: A2Agent | AgentMessenger,
    private readonly _uri: string,
    private readonly _id: string = uuidv4()
  ) {}
  /**
   * Discriminator property identifying this as an agent callable.
   */
  readonly kind: "agent" = "agent" as const;

  /** Cached agent info, populated lazily on first access. */
  private _info: Runtime.AgentInfo | undefined = undefined;
  /** Promise resolving to the agent info. avoid multiple calls to getInfo. */
  private _infoPromise: Promise<Runtime.AgentInfo> | undefined = undefined;

  /**
   * Agent metadata including name, description, skills, and capabilities.
   * Triggers async loading on first access if not already cached.
   * @returns The cached agent info or undefined if still loading
   */
  get info(): Runtime.AgentInfo | undefined {
    if (!this._info) {
      this.getInfo();
    }
    return this._info;
  }

  /**
   * The unique URI identifier for this agent within the orchestrator.
   */
  get uri(): string {
    return this._uri;
  }

  /**
   * The underlying A2A agent or client instance.
   */
  get agent(): AgentMessenger | A2Agent {
    return this._agent;
  }

  /** Bound implementation function for agent calls. */
  protected _impl: implFn = Utils.callAgent.bind(this);

  /**
   * Retrieves the full agent info, fetching from the agent if not cached.
   *
   * @returns Promise resolving to the agent's metadata including card info
   */
  async getInfo(): Promise<Runtime.AgentInfo> {
    if (this._info) {
      return this._info;
    }
    if (!this._infoPromise) {
      this._infoPromise = this.agent.getAgentCard().then((card) => ({
        ...card,
        uri: this._uri,
        id: this._id,
      }));
    }
    /*Probably overkill, but would like to avoid setting _info to undefined if the promise is rejected */
    this._info = (await this._infoPromise) ?? this._info;
    this._infoPromise = undefined;
    return this._info;
  }

  /**
   * Builds a service descriptor for this agent.
   * Used by the orchestrator to expose agent capabilities to the LLM.
   *
   * @returns Promise resolving to an AgentService descriptor
   */
  async getTarget(): Promise<Runtime.AgentService> {
    const info = await this.getInfo();
    return {
      url: info.url,
      type: "a2a",
      uri: this._uri,
      id: this._id,
      info: info,
    };
  }

  /**
   * Executes an agent request through the A2A protocol.
   *
   * Validates that the request URI matches this agent's URI,
   * then delegates to the underlying implementation.
   *
   * @param request - The agent request containing the call payload
   * @param options - Execution options including task context and abort signal
   * @returns Promise resolving to the agent's response
   * @throws {Error} If the request URI doesn't match this agent's URI
   */
  async execute({
    request,
    options,
  }: {
    request: Runtime.AgentRequest;
    options: Callable.Options;
  }): Promise<Runtime.AgentResponse> {
    if (request.uri !== this.uri) {
      throw new Error(`Invalid request URI: ${request.uri} !== ${this.uri}`);
    }
    return await this._impl(this.agent, this.uri, request, options);
  }

  /**
   * Gracefully stops the agent and releases resources.
   * Only applies to local agents; A2A clients are not stopped.
   */
  async stop(): Promise<void> {
    if (!(this.agent instanceof AgentMessenger)) {
      await this.agent.stop();
    }
  }

  /**
   * Creates a new Agent by instantiating from agent parameters.
   *
   * @param params - Configuration for creating the agent (engine, agentCard, etc.)
   * @param uri - Optional unique URI for the agent (auto-generated if omitted)
   * @returns A new Agent instance
   *
   * @example
   * ```typescript
   * const agent = Agent.create({
   *   engine: async function* (ctx) { yield "Hello!"; },
   *   agentCard: { name: "Greeter", description: "Says hello" }
   * });
   * ```
   */
  static create(params: CreateAgentParams, uri: string = uuidv4()): Agent {
    return Agent.from(createAgent(params), uri);
  }

  /**
   * Wraps an existing A2A agent or client in an invokable Agent instance.
   * automatically loads the agent info lazily.
   *
   * @param agent - The A2A agent or client to wrap
   * @param uri - Optional unique URI for the agent (auto-generated if omitted)
   * @returns A new Agent wrapper instance
   *
   * @example
   * ```typescript
   * const wrapped = Agent.from(existingAgent, "my-agent-uri");
   * ```
   */
  static from(agent: A2Agent | AgentMessenger, uri: string = uuidv4()): Agent {
    const _agent = new Agent(agent, uri, uuidv4());
    _agent.getInfo();
    return _agent;
  }
}

export const from = Agent.from;
