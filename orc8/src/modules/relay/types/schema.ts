/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import z from "zod/v4";
import { A2A } from "@artinet/sdk";

export const RelayRequest = z
  .object({
    agentId: z.string().describe("The ID of the agent to interact with."),
  })
  .describe("Defines the parameters for a request to interact with an agent.");
export type RelayRequest = z.infer<typeof RelayRequest>;
/**
 * @deprecated Use {@link RelayRequest} instead.
 */
export type AgentRelayRequest = RelayRequest;

export const GetTaskRequestSchema = RelayRequest.extend({
  taskQuery: A2A.TaskQueryParamsSchema,
}).describe(
  "Defines the parameters for a request to get a task being executed by an agent."
);
export type GetTaskRequest = z.infer<typeof GetTaskRequestSchema>;

/**
 * @deprecated Use {@link GetTaskRequest} instead.
 */
export type GetRelayTaskRequest = GetTaskRequest;

export const CancelTaskRequestSchema = RelayRequest.extend({
  taskId: A2A.TaskIdParamsSchema,
}).describe(
  "Defines the parameters for a request to cancel a task being executed by an agent."
);
export type CancelTaskRequest = z.infer<typeof CancelTaskRequestSchema>;
/**
 * @deprecated Use {@link CancelTaskRequest} instead.
 */
export type CancelRelayTaskRequest = CancelTaskRequest;

export const SendMessageRequestSchema = RelayRequest.extend({
  messageSendParams: A2A.MessageSendParamsSchema,
}).describe("Defines the parameters for sending a message to an agent.");
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
/**
 * @deprecated Use {@link SendMessageRequest} instead.
 */
export type SendRelayMessageRequest = SendMessageRequest;

export const SearchRequestSchema = z
  .object({
    query: z.string().describe("The query to search for agents."),
  })
  .describe(
    "Defines the parameters for searching for agents by name, description, or skills. The search is case insensitive and will match against the entire name, description, and skills of the agents."
  );
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * @deprecated Use {@link SearchRequest} instead.
 */
export type SearchRelayRequest = SearchRequest;
