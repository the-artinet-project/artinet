/**
 * @fileoverview
 * Core Model class for AI Agent Orchestration.
 *
 * This module provides the primary orchestration interface for coordinating
 * interactions between LLM providers, A2A agents, and MCP tool servers.
 * The Model class serves as the central hub for:
 *
 * - Managing connections to external AI services
 * - Routing requests to appropriate agents and tools
 * - Maintaining session state and conversation history
 * - Emitting events for real-time monitoring
 *
 * @example
 * ```typescript
 * const model = create({
 *   modelId: "claude-3",
 *   provider: customProvider,
 * });
 *
 * // Add tools and agents
 * model.add({ command: "npx", args: ["@mcp/server-filesystem"] });
 * model.add(myA2AAgent);
 *
 * // Execute orchestrated conversation
 * const response = await model.connect("Analyze files in the project");
 *
 * // Subscribe to real-time updates
 * model.events.on("update", (data) => console.log(data));
 * ```
 *
 * @module model
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sdk from "@artinet/sdk";
import { API } from "@artinet/types";
import * as Callable from "./types.js";
import { Manager } from "./manager.js";
import * as util from "./model-util.js";
import { Monitor } from "./monitor.js";
import { logger } from "@artinet/sdk";
import { v4 as uuidv4 } from "uuid";
import { getHistory } from "./utils/history.js";
import { artinetProvider } from "./api/connect.js";

/** Function type for adding callable services to the model. */
type AddFn = typeof util.add;

/** Function type for the reactive agentic loop. */
type ReactFn = typeof util.react;

/**
 * Represents a service execution request containing the API payload
 * and optional execution configuration.
 */
type ServiceRequest = {
  /** The API connect request to be processed. */
  request: API.ConnectRequest;
  /** Optional execution options (parentTaskId, abortSignal, etc.). */
  options?: Omit<Callable.Options, "tasks">;
  /** Optional messenger for context-aware messaging. */
  messenger?: sdk.A2A.Context["messages"];
};

/**
 * Configuration parameters for creating a new Model instance.
 *
 * @interface CreateModelParams
 */
export interface CreateModelParams
  extends Omit<
    Partial<sdk.A2A.AgentCard & { uri: string }>,
    "provider" | "skills"
  > {
  /**
   * The identifier for the underlying LLM model.
   * This is passed to the API provider to select the appropriate model.
   * @example "gpt-4", "claude-3-opus", "deepseek-r1"
   */
  modelId: string;

  /**
   * Custom API provider function for LLM communication.
   * Defaults to the Artinet API provider.
   * Implement this to integrate your own backend.
   */
  provider?: util.APIProvider;

  /**
   * Pre-registered callable services (agents and tools).
   * These are immediately available for orchestration.
   */
  services?: (Callable.Agent | Callable.Tool)[];

  /**
   * AbortSignal for cancelling in-flight operations.
   * Pass a signal from an AbortController to enable cancellation.
   */
  abortSignal?: AbortSignal;

  /**
   * Initial session state for task correlation.
   * Used to resume or continue existing conversation flows.
   */
  sessions?: Record<string, Record<string, string>>;

  /**
   * Pre-populated response history for context.
   * Useful when resuming from a saved state.
   */
  history?: Callable.Response[];

  /**
   * Custom event monitor for update/error handling.
   * Subscribe to events for real-time orchestration visibility.
   */
  events?: Monitor;

  /**
   * Instructions for the model.
   * These are added to the beginning of the request messages.
   */
  instructions?: string;
}

/**
 * Type alias for Model creation parameters.
 * Use with the `create` factory function.
 */
export type Params = CreateModelParams;

/**
 * The Model class is the primary orchestration engine for coordinating AI agents and tools.
 *
 * It extends the {@link Manager} class to provide callable management capabilities
 * and implements the core Service interface for standardized request/response handling.
 *
 * The Model maintains:
 * - A registry of callable agents and tools
 * - Session state for multi-turn conversations
 * - Response history for context preservation
 * - An event monitor for real-time updates
 *
 * @extends Manager
 * @implements {sdk.core.Service<ServiceRequest, API.ConnectResponse>}
 *
 * @example
 * ```typescript
 * // Create using factory function (recommended)
 * const model = create({ modelId: "gpt-4" });
 *
 * // Add services fluently
 * model
 *   .add({ command: "npx", args: ["-y", "@mcp/server"] })
 *   .add(myAgent);
 *
 * // Connect with a message
 * const response = await model.connect("Hello, orchestrator!");
 * ```
 */
export class Model
  extends Manager
  implements sdk.core.Service<ServiceRequest, API.ConnectResponse>
{
  /**
   * Creates a new Model instance.
   * Use the static {@link Model.create} factory method for public instantiation.
   *
   * @param modelId - The identifier for the underlying LLM model (default: "deepseek-r1")
   * @param abortSignal - Signal for cancelling in-flight operations
   * @param _provider - The API provider function for LLM communication
   * @param _data - Initial map of registered callable services
   * @param _sessions - Session state tracking for multi-agent task coordination
   * @param _history - Historical responses for context preservation
   * @param _events - Event monitor for publishing updates and errors
   */
  protected constructor(
    private readonly modelId: string = "deepseek-r1",
    readonly abortSignal: AbortSignal = new AbortController().signal,
    protected _provider: util.APIProvider = artinetProvider,
    _data: Map<string, Callable.Agent | Callable.Tool> = new Map(),
    private _sessions: Record<string, Record<string, string>> = {},
    private _history: Callable.Response[] = [],
    private _events: Monitor = new Monitor(),
    private _instructions: string = "",
    private _params: Partial<CreateModelParams> = {}
  ) {
    super(_data);
  }

  get instructions(): string {
    return this._instructions;
  }

  set instructions(instructions: string) {
    this._instructions = instructions;
  }

  /**
   * The event monitor for subscribing to orchestration updates.
   * Emits "update" events when agents/tools respond and "error" events on failures.
   */
  get events(): Monitor {
    return this._events;
  }

  /**
   * The current API provider function used for LLM communication.
   * Can be swapped at runtime for custom backend integration.
   */
  get provider(): util.APIProvider {
    return this._provider;
  }

  /**
   * Session state mapping parent task IDs to child task IDs per service URI.
   * Enables task correlation and context chaining across agent calls.
   */
  get sessions(): Record<string, Record<string, string>> {
    return this._sessions;
  }

  /**
   * Accumulated history of all callable responses for debugging and context.
   */
  get history(): Callable.Response[] {
    return this._history;
  }

  /** Bound reference to the add utility function. */
  protected _add: AddFn = util.add.bind(this);

  /** Bound reference to the reactive loop utility function. */
  protected _react: ReactFn = util.react.bind(this);

  /** Promise chain for serializing async add operations. */
  private _addPromise: Promise<void> | undefined = undefined;

  /**
   * Chains a new promise onto the add queue to ensure serial execution.
   * This prevents race conditions when multiple services are added concurrently.
   *
   * @param newPromise - The promise to add to the execution chain
   */
  private addPromise(newPromise: Promise<any>): void {
    if (this._addPromise) {
      this._addPromise = this._addPromise.then(() => newPromise);
    } else {
      this._addPromise = newPromise;
    }
  }

  /**
   * Executes a service request through the full orchestration pipeline.
   *
   * This method:
   * 1. Waits for any pending service additions to complete
   * 2. Initializes session tracking for the request
   * 3. Runs the reactive agentic loop until completion or max iterations
   * 4. Emits updates via the event monitor
   *
   * @param request - The API connect request payload
   * @param options - Optional execution configuration
   * @returns Promise resolving to the final API response
   *
   * @example
   * ```typescript
   * const response = await model.execute({
   *   request: {
   *     identifier: "gpt-4",
   *     messages: [{ role: "user", content: "Hello" }],
   *     options: {},
   *   },
   *   options: { parentTaskId: "task-123" }
   * });
   * ```
   */
  async execute({
    request,
    options,
  }: ServiceRequest): Promise<API.ConnectResponse> {
    if (this._addPromise) {
      await this._addPromise;
    }

    const parentTaskId: string = options?.parentTaskId ?? uuidv4();
    const abortSignal: AbortSignal = options?.abortSignal ?? this.abortSignal;

    if (this.instructions.trim() && this.instructions !== "") {
      request.messages.unshift({
        role: "system",
        content: this.instructions,
      });
    }

    const callback: (data: Callable.Response) => void =
      options?.callback ??
      ((data: Callable.Response) =>
        this.events.emit("update", data, undefined));

    return await this._react(
      request,
      this.provider,
      this.call.bind(this),
      this._history,
      {
        ...options,
        parentTaskId: parentTaskId,
        abortSignal: abortSignal,
        tasks: this.sessions,
        callback,
      }
    );
  }

  /**
   * Returns an A2A-compatible async generator engine for this model.
   *
   * The engine handles:
   * - Extracting user message content from the context
   * - Building the conversation history from referenced tasks
   * - Executing the orchestrated request pipeline
   * - Yielding A2A protocol status updates
   *
   * @returns An A2A Engine function for use with A2A agent infrastructure
   */
  get engine(): sdk.A2A.Engine {
    const self = this;
    return async function* (context: sdk.A2A.Context) {
      const message: string | undefined = sdk.extractTextContent(
        context.userMessage
      );

      if (!message) {
        yield sdk.describe.update.failed({
          taskId: context.taskId,
          contextId: context.contextId,
          message: sdk.describe.message({
            messageId: context.userMessage.messageId,
            parts: [{ kind: "text", text: "no user message detected" }],
          }),
        });
        return;
      }

      yield sdk.describe.update.submitted({
        taskId: context.taskId,
        contextId: context.contextId,
        message: context.userMessage,
      });

      const messages: API.Message[] = [
        ...getHistory(await context.getTask()),
        {
          role: "user",
          content: message,
        },
      ];

      const request: API.ConnectRequest = util.request(
        self.modelId,
        messages,
        await util.options(self.values)
      );
      const response: API.ConnectResponse = await self.execute({
        request,
        options: {
          parentTaskId: context.taskId,
          abortSignal: context.abortSignal,
          callback: util.bindResponses(context).bind(context),
        },
      });
      yield sdk.describe.update.completed({
        taskId: context.taskId,
        contextId: context.contextId,
        message: sdk.describe.message({
          taskId: context.taskId,
          contextId: context.contextId,
          parts: [{ kind: "text", text: util.response(response) }],
        }),
      });

      return;
    };
  }

  /**
   * Returns a fully configured A2A Agent instance wrapping this model.
   *
   * The agent exposes the model's orchestration capabilities through the
   * standard A2A protocol, enabling integration with A2A-compatible systems.
   *
   * @returns An A2A Agent instance ready for message handling
   *
   * @example
   * ```typescript
   * const agent = model.agent;
   * const result = await agent.sendMessage({
   *   message: {
   *     role: "user",
   *     parts: [{ kind: "text", text: "Process this request" }]
   *   }
   * });
   * ```
   */
  get agent(): sdk.Agent {
    return sdk.createAgent({
      agentCard: {
        ...util.createCard(
          this._params.uri ?? this._params.name ?? this.modelId,
          this.values
        ),
        ...(this._params as Partial<sdk.A2A.AgentCard>),
      },
      engine: this.engine,
      contexts: this._events,
    });
  }

  /**
   * Registers a callable service (agent or tool) with the orchestrator.
   *
   * Supports multiple service types:
   * - **MCP Tool Servers**: Pass `StdioServerParameters` with command/args
   * - **A2A Agents**: Pass an existing `sdk.Agent` or `A2AClient` instance
   * - **Agent Definitions**: Pass `CreateAgentParams` to create a new agent
   *
   * Services are added asynchronously but the method returns immediately
   * for fluent chaining. The orchestrator waits for pending additions
   * before executing requests.
   *
   * @param service - The service to register (tool config, agent, or agent params)
   * @returns This Model instance for method chaining
   *
   * @example
   * ```typescript
   * model
   *   .add({ command: "npx", args: ["-y", "@mcp/server-filesystem", "/tmp"] })
   *   .add(existingAgent)
   *   .add({ engine: myEngine, agentCard: myCard });
   * ```
   */
  add(service: util.CallableService, uri?: string): Model {
    if (
      service instanceof sdk.Service ||
      (typeof service === "object" && "engine" in service)
    ) {
      (service as sdk.Service | sdk.CreateAgentParams).contexts = this._events;
    }
    this.addPromise(
      this._add(service, uri)
        .then((callable) => {
          super.set(callable.uri, callable);
        })
        .catch((error) => {
          logger.error(
            `[Model:add]: error adding service: ${error.message}`,
            error
          );
        })
    );
    return this;
  }

  /**
   * Initiates an orchestrated conversation with the model.
   *
   * Accepts flexible input formats:
   * - Simple string message
   * - Single API.Message object
   * - Full session with message history
   * - Partial connect request
   *
   * The model will automatically route to registered agents and tools
   * as needed based on the LLM's decisions.
   *
   * @param messages - The input message(s) in any supported format
   * @param options - Optional connect options (tool/agent whitelists, etc.)
   * @returns Promise resolving to the final response string
   *
   * @example
   * ```typescript
   * // Simple string
   * const response = await model.connect("Hello!");
   *
   * // With options
   * const response = await model.connect("Use the filesystem tool", {
   *   tools: { services: [filesystemTool] }
   * });
   * ```
   */
  async connect(
    messages:
      | string
      | API.Message
      | API.Session
      | Omit<API.ConnectRequest, "options">,
    options?: API.ConnectOptions & {
      parentTaskId?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<string> {
    const request: API.ConnectRequest = util.request(
      this.modelId,
      messages,
      await util.options(this.values, options)
    );

    const response: API.ConnectResponse = await this.execute({
      request,
      options: {
        parentTaskId: options?.parentTaskId ?? uuidv4(),
        abortSignal: options?.abortSignal ?? this.abortSignal,
      },
    });

    return util.response(response);
  }

  /**
   * Factory method for creating new Model instances.
   *
   * This is the recommended way to instantiate a Model. It provides
   * sensible defaults while allowing full customization of the
   * orchestration environment.
   *
   * @param params - Configuration parameters for the model
   * @returns A new Model instance ready for service registration and execution
   *
   * @example
   * ```typescript
   * // Minimal configuration
   * const model = Model.create({ modelId: "gpt-4" });
   *
   * // Full configuration
   * const model = Model.create({
   *   modelId: "claude-3-opus",
   *   provider: myCustomProvider,
   *   services: [existingTool, existingAgent],
   *   abortSignal: controller.signal,
   *   events: customMonitor,
   * });
   * ```
   */
  static create(
    params: CreateModelParams = {
      modelId: "deepseek-r1",
      provider: artinetProvider,
      services: [],
      abortSignal: new AbortController().signal,
      sessions: {},
      history: [],
      events: new Monitor(),
      instructions: "",
    }
  ): Model {
    return new Model(
      params.modelId,
      params.abortSignal,
      params.provider,
      new Map(params.services?.map((service) => [service.uri, service]) ?? []),
      params.sessions,
      params.history,
      params.events,
      params.instructions?.trim() ?? "",
      params
    );
  }
}

/**
 * Factory function for creating new Model instances.
 * Alias for {@link Model.create} for convenient top-level imports.
 *
 * @example
 * ```typescript
 * import { create } from "@artinet/orchestrator";
 * const model = create({ modelId: "gpt-4" });
 * ```
 */
export const create = Model.create;
