/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentConfiguration, AgentConfigurationSchema } from "agent-def";
import * as armada from "@artinet/armada";
import * as sdk from "@artinet/sdk";
import { RequestAgentRoute } from "../types/definitions.js";

export const GetAgents: RequestAgentRoute["intercept"] = {
  trigger: ({ context }: RequestAgentRoute["input"]): boolean =>
    !!context.target && (context.target.agentUris?.length ?? 0) > 0,
  action: async ({
    request,
    context,
  }: RequestAgentRoute["input"]): Promise<RequestAgentRoute["request"]> => {
    for (const uri of context.target?.agentUris ?? []) {
      await armada.TryFindBase<
        typeof armada.StoredAgentSchema,
        RequestAgentRoute["request"],
        RequestAgentRoute["response"],
        RequestAgentRoute["context"]
      >(
        { request, context },
        {
          uri,
          throwNotFound: false,
          storage: context.storage,
          find: armada.FindAgent,
        }
      );
      if (!context.found || !context.found.results[uri]) {
        continue;
      }

      const agentConfig: AgentConfiguration | null = await sdk
        .validateSchema(AgentConfigurationSchema, context.found.results[uri])
        .catch((error) => {
          sdk.logger.error(
            `Failed to validate agent configuration: ${uri}`,
            error
          );
          return null;
        });

      if (!agentConfig) {
        continue;
      }

      const agent = await context.load(agentConfig, context);
      if (!agent) {
        continue;
      }

      context.agents = {
        ...context.agents,
        [uri]: agent,
      };
    }
    return request;
  },
  phase: armada.Phase.REQUEST,
};
