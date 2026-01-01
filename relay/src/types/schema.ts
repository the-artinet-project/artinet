/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import z from "zod/v4";
import { A2A } from "@artinet/sdk";

export const AgentRelayRequestSchema = z
  .object({
    agentId: z.string().describe("The ID of the agent to interact with."),
  })
  .describe("Defines the parameters for a request to interact with an agent.");
export type AgentRelayRequest = z.infer<typeof AgentRelayRequestSchema>;

export const GetRelayTaskRequestSchema = AgentRelayRequestSchema.extend({
  taskQuery: A2A.TaskQueryParamsSchema,
}).describe(
  "Defines the parameters for a request to get a task being executed by an agent."
);
export type GetRelayTaskRequest = z.infer<typeof GetRelayTaskRequestSchema>;

export const CancelRelayTaskRequestSchema = AgentRelayRequestSchema.extend({
  taskId: A2A.TaskIdParamsSchema,
}).describe(
  "Defines the parameters for a request to cancel a task being executed by an agent."
);
export type CancelRelayTaskRequest = z.infer<
  typeof CancelRelayTaskRequestSchema
>;

export const SendRelayMessageRequestSchema = AgentRelayRequestSchema.extend({
  messageSendParams: A2A.MessageSendParamsSchema,
}).describe("Defines the parameters for sending a message to an agent.");
export type SendRelayMessageRequest = z.infer<
  typeof SendRelayMessageRequestSchema
>;

export const SearchRelayRequestSchema = z
  .object({
    query: z.string().describe("The query to search for agents."),
  })
  .describe(
    "Defines the parameters for searching for agents by name, description, or skills. The search is case insensitive and will match against the entire name, description, and skills of the agents."
  );
export type SearchRelayRequest = z.infer<typeof SearchRelayRequestSchema>;
//todo: Extend server config schema
export const ClientConfigSchema = z.object({
  url: z.string().url().describe("The URL of the agent to register."),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("The headers to send to the agent."),
  fallbackPath: z
    .string()
    .optional()
    .describe(
      "The fallback path to use if the agent does not support the request."
    ),
});
export type ClientConfig = z.infer<typeof ClientConfigSchema>;
