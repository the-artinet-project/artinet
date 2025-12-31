/**
 * @fileoverview
 * Model utility functions for orchestration operations.
 *
 * This module provides the core utility functions used by the Model class
 * for request/response handling, service management, and the reactive
 * agentic loop. Key responsibilities:
 *
 * - API Provider type definition for LLM backend integration
 * - Request construction and normalization
 * - Response extraction and formatting
 * - Callable service registration
 * - Reactive loop implementation with iteration limits
 * - Agent card generation from registered services
 *
 * @module model-util
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  A2AClient,
  CreateAgentParams,
  Agent as A2A_Agent,
  Service as A2A_Service,
  A2A,
} from "@artinet/sdk";
import { API, Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Agent } from "./agent.js";
import { Tool } from "./tool.js";

/**
 * Function type for API providers that communicate with LLM backends.
 *
 * Implement this interface to integrate custom LLM backends with the orchestrator.
 * The provider receives a connect request with available tools/agents and
 * must return a response that may include tool/agent invocation requests.
 *
 * @param request - The connect request with messages and service options
 * @param abortSignal - Optional signal for request cancellation
 * @returns Promise resolving to the LLM's response with potential tool/agent calls
 *
 * @example
 * ```typescript
 * const myProvider: APIProvider = async (request, signal) => {
 *   const llmResponse = await myLLM.chat(request.messages, { signal });
 *   return {
 *     agentResponse: llmResponse.content,
 *     options: {
 *       tools: { requests: llmResponse.toolCalls }
 *     }
 *   };
 * };
 * ```
 */
export type APIProvider = (
  request: API.ConnectRequest,
  abortSignal?: AbortSignal
) => Promise<API.ConnectResponse>;

/**
 * Function type for invoking multiple callables with shared options.
 *
 * @internal
 */
export type InvokeCallables = ({
  request,
  options,
}: {
  request: Callable.Request[];
  options: Callable.Options;
}) => Promise<Callable.Response[]>;

/**
 * Extracts callable requests from an API response.
 *
 * @param response - The API response containing potential tool/agent requests
 * @returns Array of callable requests to execute
 * @internal
 */
function createCall(response: API.ConnectResponse): Callable.Request[] {
  return [
    ...(response.options?.tools?.requests ?? []),
    ...(response.options?.agents?.requests ?? []),
  ];
}

/**
 * Updates a request with callable responses and additional messages.
 *
 * Appends new responses to the appropriate tool/agent response arrays
 * and adds any new messages to the conversation.
 *
 * @param request - The request to update
 * @param responses - New callable responses to include
 * @param messages - Additional messages to append
 * @returns The updated request
 * @internal
 */
function update(
  request: API.ConnectRequest,
  responses: Callable.Response[] = [],
  messages: API.ConnectRequest["messages"] = []
): API.ConnectRequest {
  const options = request.options;
  request.options = {
    ...options,
    tools: {
      ...options?.tools,
      responses: [
        ...(options?.tools?.responses ?? []),
        ...(responses.filter((response) => Runtime.isToolResponse(response)) ??
          []),
      ],
    },
    agents: {
      ...options?.agents,
      responses: [
        ...(options?.agents?.responses ?? []),
        ...(responses.filter((response) => Runtime.isAgentResponse(response)) ??
          []),
      ],
    },
  };
  request.messages = [...request.messages, ...messages];
  return request;
}

/**
 * Builds connect options with available callable services.
 *
 * Converts registered callables into service descriptors that the LLM
 * can use to understand available tools and agents.
 *
 * @param callables - Array of registered callable services
 * @param options - Optional base options to extend
 * @returns Connect options with populated tool/agent services
 *
 * @example
 * ```typescript
 * const opts = options([myTool, myAgent], { maxTokens: 1000 });
 * // opts.tools.services contains tool descriptors
 * // opts.agents.services contains agent descriptors
 * ```
 */
export async function options(
  callables: (Callable.Agent | Callable.Tool)[],
  options?: API.ConnectOptions
): Promise<API.ConnectOptions> {
  //todo convert to async
  const targets = await Promise.all(
    callables.map(async (callable) => await callable?.getTarget?.())
  );
  const tools = targets.filter((target) => Runtime.isToolService(target));
  const agents = targets.filter((target) => Runtime.isAgentService(target));
  // Limit the options to the tools and agents that are actually available
  return {
    ...options,
    tools: {
      ...options?.tools,
      services: tools,
    },
    agents: {
      ...options?.agents,
      services: agents,
    },
  };
}

/**
 * Constructs a normalized connect request from various input formats.
 *
 * Accepts flexible input:
 * - Simple string: Converted to a single user message
 * - API.Message: Wrapped in an array
 * - API.Session: Used as-is for message array
 * - API.ConnectRequest: Merged with defaults
 *
 * @param modelId - The model identifier for the request
 * @param messages - Input in any supported format
 * @param options - Connect options with service configurations
 * @returns A normalized API.ConnectRequest
 * @throws {Error} If messages type is not recognized
 *
 * @example
 * ```typescript
 * // From string
 * const req1 = request("gpt-4", "Hello!", opts);
 *
 * // From message object
 * const req2 = request("gpt-4", { role: "user", content: "Hi" }, opts);
 *
 * // From session
 * const req3 = request("gpt-4", [msg1, msg2, msg3], opts);
 * ```
 */
export function request(
  modelId: string,
  messages: string | API.Message | API.Session | API.ConnectRequest,
  options: API.ConnectOptions
): API.ConnectRequest {
  let request: API.ConnectRequest = {
    messages: [],
    identifier: modelId,
    preferredEndpoint: "auto",
    options: options,
  };

  if (typeof messages === "string") {
    request = {
      ...request,
      messages: [{ role: "user", content: messages }],
    };
  } else if (API.isMessage(messages)) {
    request = {
      ...request,
      messages: [messages],
    };
  } else if (API.isSession(messages)) {
    request = {
      ...request,
      messages: messages,
    };
  } else if (API.isConnectRequest(messages)) {
    request = {
      ...request,
      ...messages,
    };
  } else {
    throw new Error("Invalid messages type: " + typeof messages);
  }
  return request;
}

/**
 * Extracts the text content from an API response.
 *
 * Handles various response formats:
 * - String response: Returned directly
 * - Object with string content: Extracts content
 * - Object with nested text: Extracts text property
 *
 * @param response - The API response to extract from
 * @returns The extracted text content
 */
export function response(response: API.ConnectResponse): string {
  const content =
    typeof response.message.content === "string"
      ? response.message.content
      : response.message.content?.text;
  if (!content) {
    throw new Error("No content found in response");
  }
  return content;
}

/**
 * Union type for all service types that can be added to the orchestrator.
 *
 * Supports:
 * - `A2A_Agent`: Existing A2A agent instance
 * - `A2AClient`: Remote A2A client connection
 * - `CreateAgentParams`: Parameters for creating a new agent
 * - `StdioServerParameters`: MCP server configuration for tools
 */
export type CallableService =
  | A2A_Agent
  | A2AClient
  | Omit<CreateAgentParams, "contexts">
  | StdioServerParameters;

/**
 * Converts a service definition into a callable instance.
 *
 * Automatically detects the service type and creates the appropriate
 * callable wrapper:
 * - A2A services/clients → Agent wrapper
 * - Engine-based definitions → New Agent via create
 * - Command-based definitions → New Tool via create
 *
 * @typeParam T - The specific service type being added
 * @param service - The service definition to convert
 * @returns Promise resolving to the created callable
 * @throws {Error} If the service type cannot be determined
 *
 * @example
 * ```typescript
 * // Add an MCP tool
 * const tool = await add({ command: "npx", args: ["@mcp/server"] });
 *
 * // Add an existing agent
 * const agent = await add(existingA2AAgent);
 *
 * // Add from agent parameters
 * const newAgent = await add({ engine: myEngine, agentCard: myCard });
 * ```
 */
export async function add<T extends CallableService = CallableService>(
  service: T,
  uri?: string
): Promise<Callable.Agent | Callable.Tool> {
  let callable: Callable.Agent | Callable.Tool | undefined = undefined;
  if (service instanceof A2A_Service || service instanceof A2AClient) {
    callable = Agent.from(service, uri);
  } else if (typeof service === "object" && "engine" in service) {
    callable = Agent.create(service, uri);
  } else if (typeof service === "object" && "command" in service) {
    callable = await Tool.create(service, uri);
  }
  if (!callable) {
    throw new Error(`[Model:add]: Invalid service type: ${typeof service}`);
  }
  return callable;
}

/**
 * System message injected when the agentic loop reaches max iterations.
 *
 * Instructs the LLM to summarize progress and provide next steps
 * rather than attempting additional tool/agent calls.
 * @internal
 */
const max_iterations_message: API.Message = {
  role: "system",
  content: `
The assistant has run out of executions for this task and will not be able to continue.
The assistant must now formulate a final response to the user summarising what has been achieved so far and what is left to be done.
In the final response, the assistant will also provide the user with suggestions for next steps and ask them whether they would like to continue.`,
};

/**
 * Implements the reactive agentic loop for orchestrated execution.
 *
 * This is the core orchestration loop that:
 * 1. Sends requests to the LLM provider
 * 2. Extracts tool/agent calls from the response
 * 3. Executes the calls concurrently
 * 4. Feeds results back to the LLM
 * 5. Repeats until no more calls or max iterations reached
 *
 * @param request - The initial connect request
 * @param provider - The API provider for LLM communication
 * @param call - Function to invoke callables
 * @param history - Response history for context accumulation
 * @param options - Execution options with iteration limits
 * @returns Promise resolving to the final API response
 * @throws {Error} If no response is received from the model
 *
 * @example
 * ```typescript
 * const response = await react(
 *   request,
 *   artinetProvider,
 *   manager.call.bind(manager),
 *   [],
 *   { parentTaskId: "task-1", tasks: {}, iterations: 5 }
 * );
 * ```
 */
export async function react(
  request: API.ConnectRequest,
  provider: APIProvider,
  call: InvokeCallables,
  history: Callable.Response[] = [],
  options: Callable.Options
): Promise<API.ConnectResponse> {
  let iterations: number = options.iterations ?? Callable.DEFAULT_ITERATIONS;

  let apiResponse: API.ConnectResponse | undefined = undefined;
  let results: Callable.Response[] = [];

  for (let i = 0; i < iterations && !options.abortSignal?.aborted; i++) {
    const maxIteration: API.Message[] =
      i >= iterations - 1 ? [max_iterations_message] : [];

    const updatedRequest: API.ConnectRequest = update(
      request,
      results,
      maxIteration
    );

    apiResponse = await provider(updatedRequest, options.abortSignal);

    results = await call({ request: createCall(apiResponse), options });
    if (results.length === 0) break;

    history = [...history, ...results];
  }

  if (!apiResponse) {
    throw new Error("No response from model");
  }

  return apiResponse;
}

function createSkill(value: Callable.Agent | Callable.Tool): A2A.AgentSkill {
  let name: string = `${value.kind}-${value.uri}`;
  let description: string = `${value.kind} - ${value.uri}`;

  const info: Runtime.AgentInfo | Runtime.ToolInfo | undefined = value.info;
  if (info) {
    if (Runtime.isAgentInfo(info)) {
      name = info.name;
      description = info.description;
    } else {
      name = info.implementation.name;
      description = info.instructions ?? `A ${info.implementation.name} tool.`;
    }
  }

  return {
    id: value.uri,
    name: name,
    description: description,
    tags: [value.kind],
  };
}

/**
 * Generates an A2A agent card from the model configuration.
 *
 * Creates a card describing the orchestrator as an agent, including
 * skills derived from all registered tools and agents.
 *
 * @param modelId - The model identifier for naming
 * @param callables - Registered callable services to include as skills
 * @returns A partial AgentCard with required name and description
 *
 * @example
 * ```typescript
 * const card = createCard("gpt-4", [tool1, agent1]);
 * // card.name === "gpt-4-Agent"
 * // card.skills contains descriptors for tool1 and agent1
 * ```
 */
export function createCard(
  modelId: string,
  callables: (Callable.Agent | Callable.Tool)[]
): Partial<A2A.AgentCard> & { name: string; description: string } {
  return {
    name: `${modelId}-agent`,
    description: `An agent that uses the ${modelId} large language model.`,
    skills: callables.map((value) => createSkill(value)),
  };
}

/**
 * Generates an A2A artifact update event from a callable response.
 *
 * @param taskId - The task ID to bind the artifact to
 * @param contextId - The context ID to bind the artifact to
 * @param data - The callable response to create an artifact from
 * @returns An A2A artifact update event
 *
 * @example
 * ```typescript
 * const artifact = createArtifact("task-123", "context-456", { id: "artifact-789", content: "Hello, world!" });
 * // artifact.taskId === "task-123"
 * // artifact.contextId === "context-456"
 * // artifact.kind === "artifact-update"
 * // artifact.artifact.artifactId === "artifact-789"
 * // artifact.artifact.parts[0].kind === "data"
 * // artifact.artifact.parts[0].data.content === "Hello, world!"
 * ```
 */
export function createArtifact(
  taskId: string,
  contextId: string,
  data: Callable.Response
): A2A.TaskArtifactUpdateEvent {
  const artifact: A2A.TaskArtifactUpdateEvent = {
    taskId: taskId,
    contextId: contextId,
    kind: "artifact-update",
    artifact: {
      artifactId: data.id,
      parts: [{ kind: "data", data: data as { [x: string]: unknown } }],
    },
    metadata: {
      ["timestamp"]: new Date().toISOString(),
    },
  };
  return artifact;
}

/**
 * Binds callable responses to the A2A context.
 *
 * @param context - The A2A context to bind the responses to
 * @returns A function that binds a callable response to the context
 */
export function bindResponses(
  context: A2A.Context
): (data: Callable.Response) => void {
  return (data: Callable.Response) =>
    context.publisher.onUpdate(
      createArtifact(context.taskId, context.contextId, data)
    );
}
