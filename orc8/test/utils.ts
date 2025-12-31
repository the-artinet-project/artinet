/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { API, Runtime } from "@artinet/types";
import { APIProvider } from "../src/model-util.js";

/**
 * Creates mock response options for testing.
 * Note: ConnectResponse.options has a different structure than ConnectOptions
 * - It uses `requests` for tool/agent requests from the model
 * - It uses `responses` for tool/agent responses (results)
 */
export const MOCK_RESPONSE_OPTIONS = (
  toolRequests: Runtime.ToolRequest[] = [],
  agentRequests: Runtime.AgentRequest[] = [],
  toolResponses: Runtime.ToolResponse[] = [],
  agentResponses: Runtime.AgentResponse[] = []
): API.ConnectResponse["options"] => {
  return {
    tools: {
      requests: toolRequests,
      responses: toolResponses,
    },
    agents: {
      requests: agentRequests,
      responses: agentResponses,
    },
  };
};

export const MOCK_CONNECT_RESPONSE = (
  response: string,
  options: API.ConnectResponse["options"] = MOCK_RESPONSE_OPTIONS()
): API.ConnectResponse => {
  return {
    message: { role: "assistant", content: response },
    timestamp: new Date().toISOString(),
    options: options,
  };
};

export const MOCK_PROVIDER = (
  mockResponse: API.ConnectResponse
): APIProvider => {
  return (_request: API.ConnectRequest, _abortSignal?: AbortSignal) =>
    Promise.resolve(mockResponse);
};

export function createMockProvider(
  responseMessage: string,
  toolRequests: Runtime.ToolRequest[] = [],
  agentRequests: Runtime.AgentRequest[] = []
): APIProvider {
  const apiProvider: APIProvider = MOCK_PROVIDER(
    MOCK_CONNECT_RESPONSE(
      responseMessage,
      MOCK_RESPONSE_OPTIONS(toolRequests, agentRequests)
    )
  );
  return apiProvider;
}

/**
 * Creates a mock tool request for testing.
 */
export function createMockToolRequest(
  uri: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Runtime.ToolRequest {
  return {
    type: "mcp",
    kind: "tool_request",
    uri: uri,
    call: {
      name: toolName,
      arguments: args,
    },
    id: `test-${toolName}-${Date.now()}`,
  };
}

/**
 * Creates a mock agent request for testing.
 */
export function createMockAgentRequest(
  uri: string,
  message: string
): Runtime.AgentRequest {
  return {
    type: "a2a",
    kind: "agent_request",
    uri: uri,
    call: message,
    id: `test-${uri}-${Date.now()}`,
  };
}
