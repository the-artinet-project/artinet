/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { Runtime } from "@artinet/types";
import { AgentConfigurationSchema } from "agent-def";
import { z } from "zod/v4";
/**
 * As long as the Runtime has the ServiceURI, it should be able to resolve the agent/tool information.
 * Ergonomically, it doesn't make sense to require the user to provide all of those details in the Agent.md file.
 * But once the config exits the runtime, it should be fully resolved.
 */
export const RuntimeAgentInstanceSchema = Runtime.AgentInstanceSchema.partial({
  info: true,
}).describe("Agent Service details that need to be resolved by the runtime.");
export type RuntimeAgentInstance = z.output<typeof RuntimeAgentInstanceSchema>;

export const RuntimeToolInstanceSchema = Runtime.ToolInstanceSchema.partial({
  info: true,
}).describe("Tool Service details that need to be resolved by the runtime.");
export type RuntimeToolInstance = z.output<typeof RuntimeToolInstanceSchema>;

/**
 * We expand the AgentConfigurationSchema to include the RuntimeAgentInstanceSchema and RuntimeToolInstanceSchema.
 */
export const LoadedAgentSchema = AgentConfigurationSchema.extend({
  services: z.array(z.union([Runtime.ServiceSchema, RuntimeAgentInstanceSchema, RuntimeToolInstanceSchema])).optional(),
});
export type LoadedAgent = z.output<typeof LoadedAgentSchema>;


export const UnresolvedAgentSchema = LoadedAgentSchema.partial({
  uri: true,
});
export type UnresolvedAgent = z.output<typeof UnresolvedAgentSchema>;


export interface Delta {
  sourceFile: string;
/**
 * The runtime is responsible for fully resolving the agent instance from the services
 */
  config: LoadedAgent;
  client?: boolean;
}

export interface LoadError {
  filePath: string;
  errors: any[];
}

export interface LoadResults {
  deltas: Record<string, Delta>;
  errors: LoadError[];
}

export interface Config {
  threads: number;
  availableTools: string[];
  fileExtensions: string[];
}
