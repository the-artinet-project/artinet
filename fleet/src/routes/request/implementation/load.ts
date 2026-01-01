/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { orc8, Orc8Params } from "orc8";
import { openaiProvider } from "orc8/openai";
import { AgentConfiguration } from "agent-def";
import * as sdk from "@artinet/sdk";
import { Runtime } from "@artinet/types";
import { RequestContext, loadFunction } from "../types/definitions.js";

const DEFAULT_INSTRUCTIONS =
  "You are a helpful assistant that can use tools and agents to fulfill requests.";

const requiredAgentsNotLoaded = (
  config: AgentConfiguration,
  context: RequestContext
) => {
  return (
    (!context.agents || !context.agents.length) &&
    config.agentIds &&
    config.agentIds.length > 0
  );
};

const missingAgents = (config: AgentConfiguration, context: RequestContext) => {
  return (
    config.agentIds?.filter((id) => !context.agents?.[id]).join(", ") ?? null
  );
};

export const loadAgent: loadFunction = async (
  config: AgentConfiguration,
  context?: RequestContext,
  provider = process.env.OPENAI_API_KEY
    ? openaiProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: context?.inferenceProviderUrl,
      })
    : undefined
) => {
  if (!context) {
    throw sdk.INTERNAL_ERROR({
      message: "Context not found",
    });
  }
  const o8 = orc8.create({
    ...(config as Partial<
      Omit<Orc8Params, "modelId" | "instructions" | "services" | "provider">
    >),
    modelId: config.modelId ?? "gpt-4o",
    instructions:
      config.instructions ??
      context.defaultInstructions ??
      DEFAULT_INSTRUCTIONS,
    provider,
  });

  if (requiredAgentsNotLoaded(config, context)) {
    throw sdk.INTERNAL_ERROR({
      message: `Agents not found: ${missingAgents(config, context)}`,
    });
  }

  if (missingAgents(config, context)) {
    sdk.logger.warn(`Missing agents: ${missingAgents(config, context)}`);
  }

  Object.values(context.agents ?? {}).forEach((agent) => o8.add(agent));

  config.services
    .filter(Runtime.isToolInstance)
    .filter(
      (service) =>
        Runtime.MCPStdioArgumentsSchema.safeParse(service.arguments).success
    )
    .map((service) => service.arguments as Runtime.MCPStdioArguments)
    .forEach((args) => {
      o8.add(args);
    });

  return o8.agent;
};
