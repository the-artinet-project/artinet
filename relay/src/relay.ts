/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { A2AClient, A2A } from "@artinet/sdk";
import {
  AgentType,
  IAgentRelay,
  ClientConfig,
  AgentRelayConfig,
  ScanConfig,
  SendRelayMessageRequest,
  GetRelayTaskRequest,
  CancelRelayTaskRequest,
  SearchRelayRequest,
  AgentRelayRequest,
} from "./types/index.js";
import { AgentManager, getAgentCard } from "./manager.js";
import { scanAgents, DEFAULT_MAX_THREADS } from "./scan.js";
import { getAgentRuntimePath } from "./sync.js";

export const DEFAULT_SYNC_INTERVAL = parseInt(
  process.env.ARTINET_RELAY_SYNC_INTERVAL || "30000"
);

/**
 * AgentRelay is a class that manages the agents and their interactions.
 * It scans for agents on the network and registers them.
 * It also provides a way to send messages to the agents and get tasks from them.
 * It also provides a way to get the agent card and search for agents.
 *
 * @extends AgentManager
 * @implements IAgentRelay
 *
 * @example
 * ```typescript
 * const relay = await AgentRelay.create({
 *   callerId: 'my-agent',
 *   scanConfig: {
 *     host: 'localhost',
 *     startPort: 3000,
 *     endPort: 3100
 *   }
 * });
 *
 * // Search for agents
 * const agents = await relay.searchAgents('weather');
 *
 * // Send a message to an agent
 * const result = await relay.sendMessage('agent-id', {
 *   message: { role: 'user', content: 'Hello' }
 * });
 * ```
 */
export class AgentRelay extends AgentManager implements IAgentRelay {
  private config: Required<AgentRelayConfig>;
  private timeoutId: NodeJS.Timeout | null = null;

  /**
   * Creates a new AgentRelay instance.
   *
   * @param config - Configuration object for the AgentRelay
   * @param config.agents - Optional initial map of agents
   * @param config.callerId - Optional ID of the calling agent to avoid recursive calls
   * @param config.abortSignal - Optional AbortSignal for cancellation support
   * @param config.syncInterval - Optional interval in milliseconds for agent synchronization (default: 30000)
   * @param config.configPath - Optional path to the agent runtime configuration
   * @param config.scanConfig - Optional configuration for agent scanning
   *
   * @remarks
   * Use the static `create()` method instead of the constructor directly to ensure
   * the relay is fully initialized with discovered agents.
   */
  constructor(config: AgentRelayConfig) {
    super(config.agents ?? new Map());
    this.config = {
      ...config,
      abortSignal: config.abortSignal ?? new AbortController().signal,
      syncInterval: config.syncInterval ?? DEFAULT_SYNC_INTERVAL,
      configPath: config.configPath ?? getAgentRuntimePath(),
      scanConfig: {
        ...(config.scanConfig ?? {}),
        host: config.scanConfig?.host ?? "localhost",
        startPort: config.scanConfig?.startPort ?? 3000,
        endPort: config.scanConfig?.endPort ?? 3100,
        threads: config.scanConfig?.threads ?? DEFAULT_MAX_THREADS,
      },
      agents: config.agents ?? new Map(),
    };
  }
  /**
   * Creates a new AgentRelay instance and ensures it's ready to use.
   *
   * This is the recommended way to instantiate an AgentRelay. It performs initial
   * agent discovery and starts the background synchronization process.
   *
   * @param config - The configuration for the AgentRelay
   * @param config.agents - Optional initial map of agents
   * @param config.callerId - Optional ID of the calling agent to avoid recursive calls
   * @param config.abortSignal - Optional AbortSignal for cancellation support
   * @param config.syncInterval - Optional interval in milliseconds for agent synchronization (default: 30000)
   * @param config.configPath - Optional path to the agent runtime configuration
   * @param config.scanConfig - Optional configuration for agent scanning
   *
   * @returns A fully initialized AgentRelay instance with discovered agents
   *
   * @throws {Error} If the initial agent scan or sync process fails
   *
   * @example
   * ```typescript
   * const relay = await AgentRelay.create({
   *   callerId: 'orchestrator-agent',
   *   syncInterval: 60000, // Sync every minute
   *   scanConfig: {
   *     host: 'localhost',
   *     startPort: 3000,
   *     endPort: 3200
   *   }
   * });
   * ```
   */
  static async create(
    config: AgentRelayConfig,
    sync: boolean = true
  ): Promise<AgentRelay> {
    const relay = new AgentRelay(config);
    await relay.discoverAgents(relay.config.scanConfig);
    if (sync) {
      relay.startSync().catch((error) => {
        console.error("Error running sync: ", error);
        throw error;
      });
    }
    return relay;
  }

  /**
   * Retrieves an agent by its ID.
   *
   * This method overrides the parent implementation to prevent recursive calls
   * by returning undefined if the requested agent ID matches the caller's ID.
   *
   * @param agentId - The unique identifier of the agent to retrieve
   *
   * @returns The agent instance if found and not the caller itself, undefined otherwise
   *
   * @remarks
   * This prevents an agent from calling itself through the relay, which would
   * cause infinite recursion.
   *
   * @example
   * ```typescript
   * const agent = relay.getAgent('weather-agent');
   * if (agent) {
   *   const card = await agent.agentCard();
   *   console.log(card.name);
   * }
   * ```
   */
  override getAgent(agentId: string): AgentType | undefined {
    //to avoid recursive calls
    if (agentId === this.config.callerId) {
      return undefined;
    }
    return super.getAgent(agentId);
  }

  /**
   * Closes the AgentRelay and cleans up resources.
   *
   * This method stops the background synchronization process and closes all
   * registered agent connections.
   *
   * @returns A promise that resolves when cleanup is complete
   *
   * @example
   * ```typescript
   * const relay = await AgentRelay.create(config);
   * // ... use relay ...
   * await relay.close(); // Clean shutdown
   * ```
   */
  override async close(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    await super.close();
  }

  /**
   * Starts the background synchronization process.
   *
   * Periodically scans for agents on the network at the interval specified
   * in the configuration. This keeps the agent registry up to date with
   * newly available agents and removes agents that are no longer reachable.
   *
   * @returns A promise that resolves when the sync timer is started
   *
   * @private
   *
   * @remarks
   * This method is called automatically by the `create()` factory method.
   * The sync interval can be configured via `config.syncInterval`.
   */
  private async startSync(): Promise<void> {
    this.timeoutId = setInterval(async () => {
      await this.discoverAgents(this.config.scanConfig);
    }, this.config.syncInterval);
  }

  /**
   * Discovers and registers agents on the network.
   *
   * Scans the network based on the provided configuration, registers newly
   * found agents, and removes agents that are no longer reachable.
   *
   * @param config - The scan configuration specifying host, port range, and threading
   * @param config.host - The hostname to scan (default: 'localhost')
   * @param config.startPort - The starting port of the scan range
   * @param config.endPort - The ending port of the scan range
   * @param config.threads - The number of concurrent scanning threads
   *
   * @returns A promise that resolves when the scan and registration is complete
   *
   * @public
   *
   * @remarks
   * - Errors during agent registration are logged but don't stop the process
   * - Agents that were previously registered but are no longer found are automatically removed
   */
  public async discoverAgents(config: ScanConfig): Promise<A2A.AgentCard[]> {
    const configs = await scanAgents(config).catch((error) => {
      console.error(`Error scanning agents: ${error}`);
      return [];
    });
    let liveAgents: string[] = [];
    let detectedAgents: A2A.AgentCard[] = [];
    for (const config of configs) {
      const agentCard = await this.registerAgent(config).catch((error) => {
        console.warn(`Error registering agent[${config.url}]: ${error}`);
        return undefined;
      });
      if (agentCard) {
        liveAgents.push(agentCard.name);
        detectedAgents.push(agentCard);
      }
    }
    const currentAgents = this.getAgentIds();
    const agentsToRemove = currentAgents.filter(
      (agentId: string) => !liveAgents.includes(agentId)
    );
    for (const agentId of agentsToRemove) {
      this.deregisterAgent(agentId);
    }
    return detectedAgents;
  }

  /**
   * Registers an agent with the relay.
   *
   * Accepts either an AgentType instance or a ClientConfig object. If a ClientConfig
   * is provided, it will be converted to an A2AClient instance before registration.
   *
   * @param agent - The agent to register (AgentType instance or ClientConfig)
   *
   * @returns A promise that resolves to the agent's AgentCard
   *
   * @throws {Error} If the agent type is invalid or the agent card cannot be retrieved
   * @throws {Error} If the A2AClient initialization fails for ClientConfig inputs
   *
   * @example
   * ```typescript
   * // Register with ClientConfig
   * const card = await relay.registerAgent({
   *   url: 'http://localhost:3000',
   *   headers: { 'Authorization': 'Bearer token' },
   *   fallbackPath: '/api/agent'
   * });
   *
   * // Register with existing A2AClient
   * const client = new A2AClient('http://localhost:3001');
   * const card2 = await relay.registerAgent(client);
   * ```
   *
   * @remarks
   * This method is called automatically during agent discovery but can also
   * be used to manually register agents.
   */
  async registerAgent(agent: AgentType | ClientConfig): Promise<A2A.AgentCard> {
    let agentCard = await getAgentCard(agent);
    if (
      !agentCard &&
      "url" in agent &&
      "headers" in agent &&
      "fallbackPath" in agent
    ) {
      agent = new A2AClient(agent.url, agent.headers, agent.fallbackPath);
      agentCard = await agent.agentCard();
    } else if (!agentCard) {
      throw new Error("Invalid agent type");
    }
    await super.setAgent(agent as AgentType);
    return agentCard;
  }

  /**
   * Removes an agent from the relay.
   *
   * Deregisters an agent by its ID, removing it from the registry and
   * cleaning up any associated resources.
   *
   * @param id - The unique identifier of the agent to remove
   *
   * @returns A promise that resolves when the agent is deregistered
   *
   * @example
   * ```typescript
   * await relay.deregisterAgent('weather-agent');
   * ```
   *
   * @remarks
   * This method is called automatically when agents become unreachable during
   * the sync process, but can also be called manually to remove agents.
   */
  async deregisterAgent(id: string): Promise<void> {
    super.deleteAgent(id);
  }

  /**
   * Sends a message to a registered agent.
   *
   * Routes a message to the specified agent and returns the result. The agent
   * must be registered with the relay before messages can be sent to it.
   *
   * @param agentId - The unique identifier of the target agent
   * @param messageParams - The message parameters including the message content
   * @param messageParams.message - The message to send with role and content
   * @param messageParams.sessionId - Optional session identifier for conversation continuity
   * @param messageParams.context - Optional additional context for the message
   *
   * @returns A promise that resolves to the send message result
   *
   * @throws {Error} If the agent is not found in the registry
   * @throws {Error} If the message fails to send
   *
   * @example
   * ```typescript
   * const result = await relay.sendMessage('weather-agent', {
   *   message: {
   *     role: 'user',
   *     content: 'What is the weather in San Francisco?'
   *   },
   *   sessionId: 'session-123'
   * });
   *
   * console.log(result.taskId); // Task ID for tracking
   * ```
   */
  async sendMessage(
    params: SendRelayMessageRequest
  ): Promise<A2A.SendMessageSuccessResult> {
    const { agentId, messageSendParams } = params;
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    const sendMessageResult = await agent.sendMessage(messageSendParams);
    if (!sendMessageResult) {
      throw new Error(`Failed to send message to agent ${agentId}`);
    }
    return sendMessageResult;
  }

  /**
   * Retrieves a task from a registered agent.
   *
   * Queries an agent for a specific task based on the provided query parameters.
   *
   * @param agentId - The unique identifier of the agent that owns the task
   * @param taskQuery - The query parameters to identify the task
   * @param taskQuery.taskId - The unique identifier of the task to retrieve
   * @param taskQuery.sessionId - Optional session identifier
   *
   * @returns A promise that resolves to the Task object
   *
   * @throws {Error} If the agent is not found in the registry
   * @throws {Error} If the task is not found or cannot be retrieved
   *
   * @example
   * ```typescript
   * const task = await relay.getTask('weather-agent', {
   *   taskId: 'task-123',
   *   sessionId: 'session-123'
   * });
   *
   * console.log(task.status); // 'pending', 'running', 'completed', etc.
   * console.log(task.result);
   * ```
   */
  async getTask(params: GetRelayTaskRequest): Promise<A2A.Task> {
    const { agentId, taskQuery } = params;
    const agent = this.getAgent(agentId);
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
   * Cancels a running task on a registered agent.
   *
   * Requests cancellation of a task that is currently running or pending
   * on the specified agent.
   *
   * @param agentId - The unique identifier of the agent that owns the task
   * @param taskId - The task identifier parameters
   * @param taskId.taskId - The unique identifier of the task to cancel
   * @param taskId.sessionId - Optional session identifier
   *
   * @returns A promise that resolves to the cancelled Task object
   *
   * @throws {Error} If the agent is not found in the registry
   * @throws {Error} If the task is not found or cannot be cancelled
   *
   * @example
   * ```typescript
   * const cancelledTask = await relay.cancelTask('weather-agent', {
   *   taskId: 'task-123',
   *   sessionId: 'session-123'
   * });
   *
   * console.log(cancelledTask.status); // Should be 'cancelled'
   * ```
   *
   * @remarks
   * The task cancellation behavior depends on the agent's implementation.
   * Some tasks may not be immediately cancelled if they are in a critical state.
   */
  async cancelTask(params: CancelRelayTaskRequest): Promise<A2A.Task> {
    const { agentId, taskId } = params;
    const agent = this.getAgent(agentId);
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
   * Retrieves the agent card for a registered agent.
   *
   * The agent card contains metadata about the agent including its name,
   * description, capabilities, and available skills.
   *
   * @param agentId - The unique identifier of the agent
   *
   * @returns A promise that resolves to the agent's AgentCard
   *
   * @throws {Error} If the agent is not found in the registry
   * @throws {Error} If the agent type is invalid or the card cannot be retrieved
   *
   * @example
   * ```typescript
   * const card = await relay.getAgentCard('weather-agent');
   * console.log(card.name);        // 'Weather Agent'
   * console.log(card.description); // 'Provides weather information'
   * console.log(card.skills);      // Array of available skills
   * ```
   */
  async getAgentCard(params: AgentRelayRequest): Promise<A2A.AgentCard> {
    const { agentId } = params;
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    let agentCard = await getAgentCard(agent);
    if (!agentCard) {
      throw new Error(`Invalid agent type`);
    }
    return agentCard;
  }

  /**
   * Searches for agents matching a query string.
   *
   * Performs a case-insensitive search across agent names, descriptions, and
   * skill names/descriptions. Returns all agents that match the query.
   *
   * @param query - The search query string (case-insensitive)
   *
   * @returns A promise that resolves to an array of matching AgentCards
   *
   * @example
   * ```typescript
   * // Find all weather-related agents
   * const weatherAgents = await relay.searchAgents('weather');
   *
   * // Find agents by skill
   * const translationAgents = await relay.searchAgents('translate');
   *
   * // List all agents (empty query)
   * const allAgents = await relay.searchAgents('');
   *
   * weatherAgents.forEach(card => {
   *   console.log(`${card.name}: ${card.description}`);
   * });
   * ```
   *
   * @remarks
   * - The search is performed across: agent name, description, skill names, and skill descriptions
   * - All searches are case-insensitive
   * - An empty query string will return all registered agents
   * - The search uses substring matching (not exact matching)
   */
  async searchAgents(params: SearchRelayRequest): Promise<A2A.AgentCard[]> {
    const { query } = params;
    const agents = this.getAgents();
    return (
      await Promise.all(
        agents.map(async (agent) =>
          agent instanceof A2AClient ? await agent.agentCard() : agent.agentCard
        )
      )
    ).filter(
      (agentCard: A2A.AgentCard) =>
        agentCard.name.toLowerCase().includes(query.toLowerCase()) ||
        agentCard.description.toLowerCase().includes(query.toLowerCase()) ||
        agentCard.skills.some(
          (skill: A2A.AgentSkill) =>
            skill.name.toLowerCase().includes(query.toLowerCase()) ||
            skill.description.toLowerCase().includes(query.toLowerCase())
        )
    );
  }
}
