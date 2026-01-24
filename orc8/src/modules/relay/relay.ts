/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Core relay implementation for A2A agent registration and message forwarding.
 *
 * @module orc8/relay
 *
 * @remarks
 * Use this module when you have known agent endpoints and do not require
 * automatic port discovery. For discovery-based usage, see {@link DiscoverableRelay}
 * in `./discover.ts`.
 *
 * @see {@link ./discover.ts} - Discovery-enabled relay with port scanning
 * @see {@link https://artinet.io} - A2A Protocol documentation
 */
import * as sdk from "@artinet/sdk";
import { core } from "@artinet/sdk";
import * as Callable from "../../module.js";
import type { Agent as CallableAgent, Tool as CallableTool } from "../../types.js";
import {
  Registry,
  RelayRequest,
  CancelTaskRequest,
  SearchRequest,
  GetTaskRequest,
  SendMessageRequest,
} from "./types/index.js";
import { Manager } from "./manager.js";

/**
 * Configuration options for the Relay.
 *
 * @see {@link Relay.create} - Factory method using this config
 */
export interface Config {
  /** Unique identifier preventing self-referential calls. */
  callerId: string;
  /** Optional signal to abort outgoing requests. */
  abortSignal?: AbortSignal;
  /** Optional pre-populated agent registry. */
  agents?: Map<string, sdk.Agent | sdk.AgentMessenger>;
  /** Optional storage for the relay. */
  storage?: core.Manager<CallableAgent | CallableTool>;
  /** Optional flag to throw an error if a callable is set that already exists. */
  throwOnSet?: boolean;
}

/**
 * Relay proxies A2A messages between agents.
 *
 * Provides registration, messaging, task management, and search capabilities
 * for A2A-compatible agents.
 *
 * @extends Manager
 * @implements {Registry}
 *
 * @see {@link DiscoverableRelay} - For automatic port-based agent discovery
 *
 * @example
 * ```typescript
 * import { Relay } from "orc8/relay";
 *
 * const relay = await Relay.create({ callerId: "orchestrator" });
 *
 * await relay.registerAgent({ baseUrl: "http://localhost:3001" });
 *
 * const result = await relay.sendMessage({
 *   agentId: "weather-agent",
 *   messageSendParams: {
 *     message: { role: "user", kind: "message", parts: [{ kind: "text", text: "Hello" }], messageId: "1" }
 *   }
 * });
 * ```
 */
export class Relay extends Manager implements Registry {
  private _config: Config;

  /**
   * Constructs a Relay instance.
   *
   * @param config - {@link Config} Relay configuration
   *
   * @remarks
   * Prefer {@link Relay.create} for consistent instantiation.
   */
  constructor(config: Config) {
    super(config.agents ?? new Map(), config.throwOnSet ?? true, config.storage);
    this._config = {
      callerId: config.callerId,
      abortSignal: config.abortSignal,
    };
  }

  /** Current relay configuration. */
  get config(): Config {
    return this._config;
  }

  /**
   * Retrieves a registered agent by ID.
   *
   * Returns `undefined` if the ID matches `callerId` to prevent self-calls.
   *
   * @param id - Agent identifier
   * @returns The agent instance{@link sdk.Agent}/{@link sdk.AgentMessenger}, or `undefined` if not found or self-referential
   *
   * @example
   * ```typescript
   * const agent = await relay.getAgent("weather-agent");
   * if (agent) {
   *   const card = await agent.getAgentCard();
   * }
   * ```
   */
  async getAgent(
    id: string
  ): Promise<sdk.Agent | sdk.AgentMessenger | undefined> {
    const callable = await super.get(id);
    if (!callable || !(callable instanceof Callable.Agent)) {
      return undefined;
    }
    return callable.agent;
  }

  /**
   * Closes the relay and releases resources.
   *
   * @returns Resolves when cleanup completes
   *
   * @deprecated Use {@link Relay.stop} instead.
   */
  async close(): Promise<void> {
    await super.stop();
  }

  /**
   * Registers an agent with the relay.
   *
   * Accepts a {@link sdk.Agent}, {@link sdk.AgentMessenger}, or
   * {@link sdk.MessengerParams}. If params are provided, an AgentMessenger
   * is created automatically.
   *
   * @param params - Agent instance or connection parameters
   * @returns The registered agent's card
   *
   * @throws {Error} If the agent card cannot be retrieved
   *
   * @see {@link deregisterAgent} - Remove an agent
   *
   * @example
   * ```typescript
   * // From params
   * const card = await relay.registerAgent({
   *   baseUrl: "http://localhost:3000",
   *   headers: { Authorization: "Bearer token" }
   * });
   *
   * // From existing messenger
   * const messenger = await sdk.createMessenger({ baseUrl: "http://localhost:3001" });
   * await relay.registerAgent(messenger);
   * ```
   */
  async registerAgent(
    params: sdk.Agent | sdk.AgentMessenger | sdk.MessengerParams
  ): Promise<sdk.A2A.AgentCard> {
    let agent: sdk.Agent | sdk.AgentMessenger;
    if (sdk.isMessengerParams(params)) {
      agent = await sdk.createMessenger(params);
    } else {
      agent = params;
    }
    const callable: Callable.Agent = Callable.Agent.from(
      agent,
      (await agent.getAgentCard()).name
    );
    await super.set(callable.uri, callable);
    return await callable.getInfo();
  }

  /**
   * Removes an agent from the registry.
   *
   * @param id - Agent identifier to remove
   * @returns Resolves when the agent is removed
   *
   * @see {@link registerAgent} - Add an agent
   *
   * @example
   * ```typescript
   * await relay.deregisterAgent("weather-agent");
   * ```
   */
  async deregisterAgent(id: string): Promise<void> {
    await super.delete(id);
  }

  /**
   * Sends a message to a registered agent.
   *
   * @param request - {@link SendMessageRequest} Message request containing agent ID and message params
   * @returns The {@link sdk.A2A.SendMessageSuccessResult}
   *
   * @throws {Error} If the agent is not registered
   *
   * @see {@link getTask} - Retrieve task status after sending
   *
   * @example
   * ```typescript
   * const result = await relay.sendMessage({
   *   agentId: "weather-agent",
   *   messageSendParams: {
   *     message: {
   *       role: "user",
   *       kind: "message",
   *       parts: [{ kind: "text", text: "What's the weather?" }],
   *       messageId: "msg-1"
   *     }
   *   }
   * });
   * ```
   */
  async sendMessage({
    agentId,
    messageSendParams,
  }: SendMessageRequest): Promise<sdk.A2A.SendMessageSuccessResult> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return await (agent as Callable.AbortableSender).sendMessage(
      messageSendParams,
      { signal: this.config.abortSignal }
    );
  }

  /**
   * Retrieves a task from a registered agent.
   *
   * @param request - {@link GetTaskRequest} Task query containing agent ID and task params
   * @returns The {@link sdk.A2A.Task}
   *
   * @throws {Error} If the agent or task is not found
   *
   * @see {@link cancelTask} - Cancel a running task
   *
   * @example
   * ```typescript
   * const task = await relay.getTask({
   *   agentId: "weather-agent",
   *   taskQuery: { taskId: "task-123" }
   * });
   * console.log(task.status);
   * ```
   */
  async getTask({ agentId, taskQuery }: GetTaskRequest): Promise<sdk.A2A.Task> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    const task = await agent.getTask(taskQuery);
    if (!task) {
      throw new Error(`Task ${agentId} not found`);
    }
    return task;
  }

  /**
   * Cancels a task on a registered agent.
   *
   * @param request - {@link CancelTaskRequest} Cancel request containing agent ID and task ID
   * @returns The {@link sdk.A2A.Task}
   *
   * @throws {Error} If the agent or task is not found
   *
   * @remarks
   * Cancellation behavior depends on the agent implementation. Tasks in
   * critical states may not cancel immediately.
   *
   * @see {@link getTask} - Check task status
   *
   * @example
   * ```typescript
   * const task = await relay.cancelTask({
   *   agentId: "weather-agent",
   *   taskId: { id: "task-123" }
   * });
   * ```
   */
  async cancelTask({
    agentId,
    taskId,
  }: CancelTaskRequest): Promise<sdk.A2A.Task> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    const task = await agent.cancelTask(taskId);
    if (!task) {
      throw new Error(`Task ${agentId} not found`);
    }
    return task;
  }

  /**
   * Retrieves an agent's card containing metadata and capabilities.
   *
   * @param request - {@link RelayRequest} Request containing the agent ID
   * @returns The {@link sdk.A2A.AgentCard}
   *
   * @throws {Error} If the agent is not found or card is unavailable
   *
   * @see {@link searchAgents} - Find agents by query
   *
   * @example
   * ```typescript
   * const card = await relay.getAgentCard({ agentId: "weather-agent" });
   * console.log(card.name, card.skills);
   * ```
   */
  async getAgentCard({ agentId }: RelayRequest): Promise<sdk.A2A.AgentCard> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    let agentCard = await agent.getAgentCard();
    if (!agentCard) {
      throw new Error(`Invalid agent type`);
    }
    return agentCard;
  }

  /**
   * Searches registered agents by name, description, or skills.
   *
   * Performs case-insensitive substring matching across agent metadata.
   *
   * @param request - {@link SearchRequest} Search query
   * @returns Matching {@link sdk.A2A.AgentCard[]} (empty array if query is empty)
   *
   * @example
   * ```typescript
   * const agents = await relay.searchAgents({ query: "weather" });
   * agents.forEach(card => console.log(card.name));
   * ```
   */
  async searchAgents({ query }: SearchRequest): Promise<sdk.A2A.AgentCard[]> {
    const cards = await this.getAgentCards();
    const searchQuery = query.toLowerCase().trim();
    if (searchQuery.length === 0) {
      return [];
    }
    return cards.filter(
      (agentCard: sdk.A2A.AgentCard) =>
        agentCard.name.toLowerCase().includes(searchQuery) ||
        agentCard.description.toLowerCase().includes(searchQuery) ||
        agentCard.skills.some(
          (skill: sdk.A2A.AgentSkill) =>
            skill.name.toLowerCase().includes(searchQuery) ||
            skill.description.toLowerCase().includes(searchQuery) ||
            skill.tags.some((tag: string) =>
              tag.toLowerCase().includes(searchQuery)
            )
        )
    );
  }

  /**
   * Creates and initializes a Relay instance.
   *
   * @param config - {@link Config} Relay configuration
   * @returns Initialized {@link Relay} instance
   *
   * @example
   * ```typescript
   * const relay = await Relay.create({ callerId: "my-orchestrator" });
   * ```
   */
  static async create(config: Config): Promise<Relay> {
    const relay = new Relay(config);
    return relay;
  }
}
