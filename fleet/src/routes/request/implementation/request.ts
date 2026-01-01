/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentConfiguration, AgentConfigurationSchema } from "agent-def";
import * as sdk from "@artinet/sdk";
import { RequestAgentRoute } from "../types/definitions.js";

export const requestImplementation: RequestAgentRoute["implementation"] =
  async (request, context) => {
    if (!context.target) {
      throw sdk.INTERNAL_ERROR({
        message: `Agent ${context.agentId} not found: ${sdk.formatJson(
          context.found?.error ?? { error: "Unknown error" }
        )}`,
        method: request.method,
      });
    }

    const agentConfig: AgentConfiguration = await sdk.validateSchema(
      AgentConfigurationSchema,
      context.target
    );

    const agent = await context.load(agentConfig, context);
    if (!agent) {
      throw sdk.INTERNAL_ERROR({
        data: {
          message: `Agent ${context.agentId} failed to load`,
        },
      });
    }

    const response = await context.invoke(request, agent, context);
    if (!response) {
      throw sdk.INTERNAL_ERROR({
        data: {
          message: `Agent ${context.agentId} failed to invoke`,
        },
      });
    }

    return response;
  };
