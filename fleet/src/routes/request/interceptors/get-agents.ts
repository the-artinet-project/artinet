import { AgentConfiguration, AgentConfigurationSchema } from "agent-def";
import * as armada from "@artinet/armada";
import * as sdk from "@artinet/sdk";
import { RequestAgentRoute } from "../types/definitions.js";

export const GetAgents: RequestAgentRoute["intercept"] = {
  trigger: ({ context }: RequestAgentRoute["input"]): boolean =>
    !!context.target && (context.target.agentIds?.length ?? 0) > 0,
  action: async ({
    request,
    context,
  }: RequestAgentRoute["input"]): Promise<RequestAgentRoute["request"]> => {
    for (const agentId of context.target?.agentIds ?? []) {
      await armada.TryFindBase<
        typeof armada.StoredAgentSchema,
        RequestAgentRoute["request"],
        RequestAgentRoute["response"],
        RequestAgentRoute["context"]
      >(
        { request, context },
        {
          uri: agentId,
          throwNotFound: false,
          storage: context.storage,
          find: armada.FindAgent,
        }
      );
      if (!context.found || !context.found.results[agentId]) {
        continue;
      }

      const agentConfig: AgentConfiguration | null = await sdk
        .validateSchema(
          AgentConfigurationSchema,
          context.found.results[agentId]
        )
        .catch((error) => {
          sdk.logger.error(
            `Failed to validate agent configuration: ${agentId}`,
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
        [agentId]: agent,
      };
    }
    return request;
  },
  phase: armada.Phase.REQUEST,
};
