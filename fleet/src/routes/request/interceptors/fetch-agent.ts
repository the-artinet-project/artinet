/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import { AgentConfigurationSchema } from "agent-def";
import * as sdk from "@artinet/sdk";
import { RequestAgentRoute } from "../types/definitions.js";

export const FetchAgent: RequestAgentRoute["intercept"] = {
  trigger: ({ context }: RequestAgentRoute["input"]): boolean =>
    !context.target,
  action: async ({
    request,
    context,
  }: RequestAgentRoute["input"]): Promise<RequestAgentRoute["request"]> =>
    armada
      .TryFindBase<
        typeof armada.StoredAgentSchema,
        RequestAgentRoute["request"],
        RequestAgentRoute["response"],
        RequestAgentRoute["context"]
      >(
        { request, context },
        {
          uri: context.agentId,
          throwNotFound: true,
          storage: context.storage,
          find: armada.FindAgent,
        }
      )
      .then(async (request) => {
        if (!context.found) {
          throw sdk.INTERNAL_ERROR({
            data: {
              message: `agent ${context.agentId} not found`,
            },
          });
        }
        context.target = await sdk.validateSchema(
          AgentConfigurationSchema,
          Object.values(context.found.results)[0]
        );
        context.found = undefined;
        return request;
      }),
  phase: armada.Phase.REQUEST,
};
