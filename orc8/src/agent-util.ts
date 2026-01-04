/**
 * @fileoverview
 * Agent utility functions for A2A protocol communication.
 *
 * This module provides low-level utilities for sending messages to A2A agents
 * and handling session management across agent calls. Key responsibilities:
 *
 * - Session tracking: Maintains task ID mappings between parent and child tasks
 * - Message formatting: Converts various input formats to A2A MessageSendParams
 * - Response normalization: Transforms A2A results into standard AgentResponse format
 * - Error handling: Gracefully captures and propagates agent communication errors
 *
 * These utilities are typically used internally by the {@link Agent} class
 * but can be accessed directly for advanced use cases.
 *
 * @module agent-util
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  A2A,
  AgentMessenger,
  Agent as A2Agent,
  MessageSender,
  createMessageSendParams,
  logger,
} from "@artinet/sdk";
import { Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { v4 as uuidv4 } from "uuid";

export interface AbortableSender extends MessageSender {
  sendMessage(
    params: A2A.MessageSendParams,
    options?: { signal?: AbortSignal }
  ): Promise<A2A.SendMessageSuccessResult>;
}
/**
 * Manages session state for agent calls within a parent task context.
 *
 * Creates or retrieves the child task ID for this agent within the parent task,
 * and populates reference task IDs for context chaining.
 *
 * @param uri - The agent's unique identifier
 * @param parentTaskId - The parent task ID coordinating this call
 * @param tasks - Session state map tracking parent->child task relationships
 * @param callParams - The message parameters to update with session info
 *
 * @internal
 */
const _session = (
  uri: string,
  parentTaskId: string,
  tasks: Record<string, Record<string, string>>,
  callParams: A2A.MessageSendParams
) => {
  let sessionId = tasks[parentTaskId]?.[uri];
  if (!sessionId) {
    logger.debug("creating new session", { parentTaskId, uri });
    sessionId = callParams.message.taskId ?? uuidv4();
    if (!tasks[parentTaskId]) {
      tasks[parentTaskId] = {};
    }
    tasks[parentTaskId][uri] = sessionId;
  }

  callParams.message.taskId = sessionId;
  callParams.message.referenceTaskIds = [
    ...(Object.values(tasks[parentTaskId]) ?? []),
    ...(callParams.message.referenceTaskIds ?? []),
  ];
};

/**
 * Normalizes an A2A result into a standard AgentResponse format.
 *
 * @param request - The original agent request
 * @param result - The A2A success result, or null/undefined on failure
 * @param error - Any error that occurred during the call
 * @returns A normalized AgentResponse object
 *
 * @internal
 */
const _response = (
  request: Runtime.AgentRequest,
  result: A2A.SendMessageSuccessResult | undefined | null,
  error: Error | undefined
): Runtime.AgentResponse => {
  return {
    type: "a2a",
    callerId: request.callerId ?? "unknown",
    kind: "agent_response",
    uri: request.uri,
    call: request.call,
    result: result ?? error?.message ?? "unknown error",
    error: error,
    id: request.id ?? uuidv4(),
  };
};

/**
 * Sends a message to an A2A agent and returns the response.
 *
 * Handles the complete agent call lifecycle:
 * 1. Converts the request call to A2A MessageSendParams
 * 2. Applies session tracking for task correlation
 * 3. Sends the message via the A2A protocol
 * 4. Normalizes the result into a standard AgentResponse
 *
 * @param agent - The A2A agent or client to call
 * @param uri - The agent's unique identifier
 * @param request - The agent request containing the call payload
 * @param options - Execution options with task context and abort signal
 * @returns Promise resolving to the normalized agent response
 *
 * @example
 * ```typescript
 * const response = await callAgent(agent, "my-agent", {
 *   kind: "agent_request",
 *   uri: "my-agent",
 *   call: "Process this request"
 * }, {
 *   parentTaskId: "parent-123",
 *   tasks: { "parent-123": {} }
 * });
 * ```
 */
export async function callAgent(
  agent: AgentMessenger | A2Agent,
  uri: string,
  request: Runtime.AgentRequest,
  {
    parentTaskId,
    tasks = {},
    abortSignal = new AbortController().signal,
  }: Callable.Options
): Promise<Runtime.AgentResponse> {
  let _error: Error | undefined = undefined;

  const callParams: A2A.MessageSendParams =
    typeof request.call === "string"
      ? createMessageSendParams(request.call)
      : createMessageSendParams({ message: request.call });

  _session(uri, parentTaskId, tasks, callParams);
  const result: A2A.SendMessageSuccessResult | undefined | null = await (
    agent as AbortableSender
  )
    .sendMessage(callParams, { signal: abortSignal })
    .catch((error) => {
      logger.error(
        `[${request.id}:${parentTaskId}]error sending message to agent[${uri}]: `,
        error
      );
      _error = error as Error;
      return undefined;
    });

  return _response(request, result, _error);
}
