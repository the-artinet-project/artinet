/**
 * @fileoverview OpenAI ↔ Artinet type adapter.
 *
 * Bidirectional conversion between OpenAI Chat Completions API and
 * Artinet Connect request/response types. Enables the orchestrator to
 * use any OpenAI-compatible backend (OpenAI, Azure, Ollama, etc.).
 *
 * Key conversions:
 * - Messages: Artinet roles → OpenAI roles (agent/assistant → assistant)
 * - Tools: MCP tools & A2A agents → OpenAI function tools
 * - Requests: ConnectRequest → ChatCompletionCreateParams
 * - Responses: ChatCompletion → ConnectResponse (with tool/agent routing)
 *
 * URI encoding scheme: `{type}_-_{shortUri}_-_{name}` maps tool names
 * to their service URIs for response routing.
 *
 * @module api/openai-util
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import openai from "openai";
import { API, Runtime, Experimental } from "@artinet/types";
import { extractTextContent, formatJson, logger, safeParse } from "@artinet/sdk";
import z, { toJSONSchema } from "zod/v4";
import * as Callables from "../types.js";

const customSeparator = "_-_";

const encodeUriInfo = (
  type: "mcp" | "a2a",
  uri: string,
  name: string = ""
): string => `${type}${customSeparator}${uri}${customSeparator}${name}`;

function mcpName(uri: string, toolName: string): string {
  return encodeUriInfo("mcp", uri, toolName);
}

function a2aName(uri: string, agentName: string = ""): string {
  return encodeUriInfo("a2a", uri, agentName);
}

function shortenUri(uri: string): string {
  return uri.split("-").pop() ?? uri;
}

function expandUri(shortUri: string, uriMap: Map<string, string>): string {
  return uriMap.get(shortUri) ?? shortUri;
}

function extractUriInfo(
  name: string,
  uriMap: Map<string, string>
): { type: "mcp" | "a2a"; uri: string; name: string } {
  const [_type, shortUri, _name] = name.split(customSeparator);
  return {
    type: _type as "mcp" | "a2a",
    uri: expandUri(shortUri, uriMap),
    name: _name,
  };
}

function cacheUri(uri: string, uriMap: Map<string, string>): string {
  const shortUri = shortenUri(uri);
  uriMap.set(shortUri, uri);
  return shortUri;
}

function openaiFunction(
  name: string,
  description?: string,
  parameters?: Record<string, unknown>
): openai.ChatCompletionFunctionTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters,
    },
  };
}

function openaiFunctionCall(
  id: string,
  _function: Experimental.FunctionCall["function"]
): openai.ChatCompletionMessageFunctionToolCall {
  return {
    type: "function",
    function: _function,
    id,
  };
}

/** MCP ToolInfo → OpenAI function tools. */
export function mcpFunction(
  uri: string,
  tool: Runtime.ToolInfo
): openai.ChatCompletionTool[] {
  if (!tool.tools || tool.tools.length === 0) return [];
  return tool.tools.map((tool) =>
    openaiFunction(
      mcpName(uri, tool.name),
      tool.description,
      tool.inputSchema as Record<string, unknown>
    )
  );
}

const rootSchema = z
  .object({
    message: z.string(),
  })
  .describe("A2A function call parameters schema");
const a2aFunctionSchema = toJSONSchema(rootSchema);

/** A2A AgentInfo → OpenAI function tools. Creates one tool per skill, or a default tool if no skills. */
export function a2aFunction(
  uri: string,
  agent: Runtime.AgentInfo
): openai.ChatCompletionTool[] {
  if (agent.skills && agent.skills.length > 0) {
    return agent.skills.map((skill) =>
      openaiFunction(
        a2aName(uri, skill.name),
        `ask agent ${agent.name} to perform skill ${
          skill.name
        } with description: ${
          skill.description ?? agent.description
        } and the following examples: ${skill.examples?.join(", ")}`,
        a2aFunctionSchema
      )
    );
  }
  return [
    openaiFunction(
      a2aName(uri, agent.name),
      `ask agent ${agent.name} with description: ${agent.description} to perform a task`,
      a2aFunctionSchema
    ),
  ];
}

function artinetFunction(
  service: Runtime.Service,
  uriMap: Map<string, string>
): openai.ChatCompletionTool[] {
  if (
    !service.info ||
    (!Runtime.isToolInfo(service.info) && !Runtime.isAgentInfo(service.info))
  ) {
    const err = new Error(
      `Unsupported or uninitialized service detected: ${formatJson(service)}`
    );
    logger.error("Error creating OpenAI tools:", err);
    throw err;
  }

  const shortUri = cacheUri(service.uri, uriMap);
  if (service.type === "mcp") {
    return mcpFunction(shortUri, service.info as Runtime.ToolInfo);
  }
  return a2aFunction(shortUri, service.info);
}
/** Artinet Services → OpenAI function tools. Returns tools + URI map for routing responses. */
export function openaiTools(services?: Runtime.Service[]): {
  tools: openai.ChatCompletionTool[];
  uriMap: Map<string, string>;
} {
  if (!services || services.length === 0)
    return { tools: [], uriMap: new Map() };

  const uriMap = new Map<string, string>();
  const tools = services
    .filter((service) => service !== undefined)
    .filter(
      (service) =>
        Runtime.isToolService(service) || Runtime.isAgentService(service)
    )
    .map((service) => artinetFunction(service, uriMap))
    .flat();
  return { tools, uriMap };
}

function agentContent(
  response: Runtime.AgentResponse
): openai.ChatCompletionToolMessageParam["content"] {
  if (typeof response.result === "string") return response.result;

  return extractTextContent(response.result, false) ?? "";
}

function openaiToolMessageContent(
  response: Callables.Response
): openai.ChatCompletionToolMessageParam["content"] {
  if (
    !response.result ||
    (typeof response.result !== "string" &&
      !Runtime.isToolResponse(response) &&
      !Runtime.isAgentResponse(response))
  ) {
    const err = new Error(
      `Unsupported response detected: ${formatJson(response)}`
    );
    logger.error("Error creating OpenAI tool response:", err);
    throw err;
  }

  if (typeof response.result === "string") return response.result;
  if (response.kind === "tool_response") {
    return response.result.content.filter((c) => c.type === "text");
  }

  return agentContent(response);
}

/** Artinet tool/agent response → OpenAI tool message. */
export function openaiToolMessage(
  response: Callables.Response
): openai.ChatCompletionToolMessageParam {
  return {
    role: "tool",
    tool_call_id: response.id,
    content: openaiToolMessageContent(response),
  };
}

function openaiRebuildFunctionCalls(
  responses: Callables.Response[]
): openai.ChatCompletionAssistantMessageParam | null {
  if (responses.length === 0) return null;

  const functionResponses = responses.filter(
    (response) =>
      Runtime.isToolResponse(response) || Runtime.isAgentResponse(response)
  );

  const mcpFunctionCalls = functionResponses
    .filter((response) => response.kind === "tool_response")
    .map((response) => {
      return openaiFunctionCall(response.id, {
        name: response.call.name,
        arguments: JSON.stringify(response.call.arguments ?? {}),
      });
    });

  const a2aFunctionCalls = functionResponses
    .filter((response) => response.kind === "agent_response")
    .map((response) => {
      return openaiFunctionCall(response.id, {
        name: a2aName(shortenUri(response.uri)),
        arguments: JSON.stringify({ message: response.call }),
      });
    });

  return {
    role: "assistant",
    content: null,
    tool_calls: [...mcpFunctionCalls, ...a2aFunctionCalls],
  };
}

/**
 * Artinet role → OpenAI role. Maps "agent" to "assistant".
 * Converts an Artinet message role to OpenAI role.
 * Artinet roles: "user" | "agent" | "assistant" | "system"
 * OpenAI roles: "system" | "user" | "assistant" | "tool" | "developer"
 */
const openaiRole = (
  role: API.Message["role"]
): "system" | "user" | "assistant" => {
  if (role === "agent" || role === "assistant") return "assistant";
  return role as "system" | "user";
};

/** Extracts string content from Artinet message (handles string | {text} formats). */
function openaiMessageContent(content: API.Message["content"]): string {
  if (typeof content === "string") return content;
  if (typeof content === "object" && "text" in content) return content.text;
  return "";
}

function openaiMessage(msg: API.Message): openai.ChatCompletionMessageParam {
  return {
    role: openaiRole(msg.role),
    content: openaiMessageContent(msg.content),
  };
}

/**
 * Artinet messages → OpenAI messages.
 * If responses provided, reconstructs assistant tool_calls + tool messages.
 */
export function openaiMessages(
  messages: API.Message[],
  responses?: Callables.Response[]
): openai.ChatCompletionMessageParam[] {
  const _messages: openai.ChatCompletionMessageParam[] = messages
    .map((msg) => openaiMessage(msg))
    .filter((msg) => msg.content !== "");

  if (!responses || !responses.length) return _messages;

  const assistantMessage: openai.ChatCompletionAssistantMessageParam | null =
    openaiRebuildFunctionCalls(responses);

  if (!assistantMessage) return _messages;

  _messages.push(assistantMessage);
  _messages.push(...responses.map((response) => openaiToolMessage(response)));

  return _messages;
}

/**
 * ConnectRequest → ChatCompletionCreateParams.
 * Converts an Artinet ConnectRequest to OpenAI ChatCompletionCreateParams.
 * Handles message conversion, tool definitions, and tool response reconstruction.
 * @param request - The Artinet connect request
 * @returns OpenAI-compatible chat completion parameters
 *
 * @example
 * ```typescript
 * const openaiParams = toOpenAIRequest(connectRequest);
 * const completion = await openai.chat.completions.create(openaiParams);
 * ```
 */
/**
 * Reconstructs an assistant message with tool_calls from Artinet responses.
 * OpenAI requires tool response messages to be preceded by an assistant
 * message containing the corresponding tool_calls.
 */
export function openaiRequest(request: API.ConnectRequest): {
  params: openai.ChatCompletionCreateParamsNonStreaming;
  uriMap: Map<string, string>;
} {
  const messages: openai.ChatCompletionMessageParam[] = openaiMessages(
    request.messages,
    [
      ...(request.options?.tools?.responses ?? []),
      ...(request.options?.agents?.responses ?? []),
    ]
  );

  const params: openai.ChatCompletionCreateParamsNonStreaming = {
    model: request.identifier,
    messages,
    stream: false,
  };

  const { tools, uriMap } = openaiTools(
    [
      ...(request.options?.tools?.services ?? []),
      ...(request.options?.agents?.services ?? []),
    ].filter((service) => service !== undefined)
  );

  params.tools = tools;

  return { params, uriMap };
}

const validateFunctionCall = (
  callerId: string,
  functionCall: Experimental.FunctionCall
): void => {
  if (!Experimental.isFunctionCall(functionCall)) {
    throw new Error(
      `Caller: ${callerId} sent an unsupported function call: ${formatJson(
        functionCall
      )}`
    );
  }
};

/** OpenAI function call → Artinet ToolRequest or AgentRequest. Uses uriMap to expand short URIs. */
export function artinetRequest(
  callerId: string = "unknown",
  functionCall: Experimental.FunctionCall,
  uriMap: Map<string, string>
): Callables.Request {
  validateFunctionCall(callerId, functionCall);

  const _call = functionCall;
  const { type, uri, name } = extractUriInfo(_call.function.name, uriMap);
  const id = _call.id;
  const args = _call.function.arguments;

  if ((type !== "mcp" && type !== "a2a") || !name || !id) {
    throw new Error(
      `Caller: ${callerId} sent an unsupported function call: ${formatJson(
        _call
      )}`
    );
  }

  if (type === "mcp") {
    const request: Runtime.ToolRequest = {
      kind: "tool_request",
      id,
      uri,
      type,
      callerId,
      call: {
        name,
        arguments: safeParse(args),
      },
    };
    return request;
  }

  const call: Runtime.AgentRequest["call"] =
    rootSchema.safeParse(args).data?.message ?? args;

  const request: Runtime.AgentRequest = {
    kind: "agent_request",
    id,
    uri,
    type,
    callerId,
    call,
  };
  return request;
}

/**
 * ChatCompletion → ConnectResponse.
 * Converts an OpenAI ChatCompletion to Artinet ConnectResponse.
 * Extracts tool_calls and routes to tools vs agents based on URI prefix.
 *
 * @param completion - The OpenAI chat completion response
 * @param toolServiceUri - URI to assign to tool requests (for routing)
 * @returns Artinet-compatible connect response
 *
 * @example
 * ```typescript
 * const completion = await openai.chat.completions.create(params);
 * const response = artinetResponse(completion);
 * ```
 */
export function artinetResponse(
  completion: openai.ChatCompletion,
  uriMap: Map<string, string>
): API.ConnectResponse {
  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error("No message found in completion");
  }

  const response: API.ConnectResponse = {
    timestamp: new Date(completion.created * 1000).toISOString(),
    message: message,
  };

  if (!message.tool_calls || message.tool_calls.length === 0) {
    return response;
  }

  const requests: Callables.Request[] = message.tool_calls
    .filter(Experimental.isFunctionCall)
    .map((functionCall) =>
      artinetRequest(functionCall.id, functionCall, uriMap)
    );

  const toolRequests = requests.filter(Runtime.isToolRequest);
  const agentRequests = requests.filter(Runtime.isAgentRequest);

  logger.debug("openaiProvider:Response:", formatJson(response));
  logger.debug("openaiProvider:ToolRequests:", formatJson(toolRequests));
  logger.debug("openaiProvider:AgentRequests:", formatJson(agentRequests));

  return {
    ...response,
    options: {
      tools: {
        requests: toolRequests,
        responses: [],
      },
      agents: {
        requests: agentRequests,
        responses: [],
      },
    },
  };
}
