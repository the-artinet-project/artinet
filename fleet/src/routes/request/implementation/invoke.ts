import { z } from "zod/v4";
import * as sdk from "@artinet/sdk";
import {
  RequestAgentRoute,
  Agent,
  invokeFunction,
  AgentError,
} from "../types/definitions.js";
import { assert } from "console";

function isClient(agent: unknown): agent is sdk.A2AClient {
  return agent instanceof sdk.A2AClient;
}

export const invoke = async (
  type: "success" | "error" | "stream",
  request: RequestAgentRoute["request"],
  invocable:
    | Promise<sdk.A2A.ResponseResult | sdk.A2A.AgentCard>
    | AsyncIterable<sdk.A2A.Update>
): Promise<RequestAgentRoute["response"] | null> => {
  let result:
    | sdk.A2A.ResponseResult
    | sdk.A2A.AgentCard
    | undefined
    | AsyncIterable<sdk.A2A.Update> = undefined;

  try {
    sdk.logger.info(`invoke:${request.method}`);
    sdk.logger.debug(`invoke:${request.method}`, { params: request.params });
    result = await invocable;
    sdk.logger.debug(`invocation completed:${request.method}`, { result });
  } catch (error) {
    sdk.logger.error(
      `invocation error:${request.method}:error:${JSON.stringify(
        error,
        null,
        2
      )}`,
      { error }
    );
    return {
      type: "error",
      error: error as any,
    };
  }

  if (!result) {
    sdk.logger.error(`invocation failed:${request.method}`, { result });
    return {
      type: "error",
      error: sdk.INTERNAL_ERROR({
        message: "Internal error: No result from invocation",
        method: request.method,
      }) as AgentError,
    };
  }

  if (type === "success") {
    return {
      type: "success",
      result: result as sdk.A2A.ResponseResult | sdk.A2A.AgentCard,
    };
  }
  if (type === "stream") {
    return {
      type: "stream",
      stream: result as AsyncIterable<sdk.A2A.Update>,
    };
  }

  return {
    type: "error",
    error: sdk.INTERNAL_ERROR({
      message: "Internal error: Invalid result type",
      method: request.method,
    }) as AgentError,
  };
};

export const callAgent = async (
  request: RequestAgentRoute["request"],
  agent: sdk.A2A.Service,
  params:
    | NonNullable<z.output<typeof sdk.A2A.RequestParamSchema>>
    | { validation: string } = { validation: "no params provided" }
): Promise<RequestAgentRoute["response"] | null> => {
  switch (request.method) {
    case "message/send": {
      return await invoke(
        "success",
        request,
        agent.sendMessage(params as sdk.A2A.MessageSendParams)
      );
    }
    case "message/stream": {
      return await invoke(
        "stream",
        request,
        agent.streamMessage(params as sdk.A2A.MessageSendParams)
      );
    }
    case "task/resubscribe": {
      return await invoke(
        "stream",
        request,
        agent.resubscribe(params as sdk.A2A.TaskIdParams)
      );
    }
    case "task/get": {
      return await invoke(
        "success",
        request,
        agent.getTask(params as sdk.A2A.TaskQueryParams)
      );
    }
    case "task/cancel": {
      return await invoke(
        "success",
        request,
        agent.cancelTask(params as sdk.A2A.TaskIdParams)
      );
    }
    case "task/pushNotificationConfig/set": {
      if (!isClient(agent)) {
        throw sdk.PUSH_NOTIFICATION_NOT_SUPPORTED({
          data: {
            message: "Push notifications are not supported for clients",
            method: request.method,
          },
        });
      }
      return await invoke(
        "success",
        request,
        agent.setTaskPushNotification(
          params as sdk.A2A.TaskPushNotificationConfig
        )
      );
    }
    case "task/pushNotificationConfig/get": {
      if (!isClient(agent)) {
        throw sdk.PUSH_NOTIFICATION_NOT_SUPPORTED({
          data: {
            message: "Push notifications are not supported for clients",
            method: request.method,
          },
        });
      }

      return await invoke(
        "success",
        request,
        agent.getTaskPushNotification(params as sdk.A2A.TaskIdParams)
      );
    }
    case "task/pushNotificationConfig/list": {
      throw sdk.PUSH_NOTIFICATION_NOT_SUPPORTED({
        data: {
          message: "Push notifications are not supported for clients",
          method: request.method,
        },
      });
    }
    case "task/pushNotificationConfig/delete": {
      throw sdk.PUSH_NOTIFICATION_NOT_SUPPORTED({
        data: {
          message: "Push notifications are not supported for clients",
          method: request.method,
        },
      });
    }
    case "agentcard/get":
    case "agent/getAuthenticatedExtendedCard": {
      return await invoke("success", request, agent.getAgentCard());
    }
    default:
      throw sdk.METHOD_NOT_FOUND({
        data: {
          message: "Method not found",
          method: request.method,
        },
      });
  }
};

export const invokeAgent: invokeFunction = async (
  request: RequestAgentRoute["request"],
  _agent: Agent
): Promise<RequestAgentRoute["response"] | null> => {
  sdk.logger.info("Invoking agent: " + request.method);
  const _params: z.output<typeof sdk.A2A.RequestParamSchema> =
    await sdk.validateSchema(sdk.A2A.RequestParamSchema, request.params);
  const params = _params ?? { validation: "no params provided" };

  sdk.logger.debug(
    `invokeAgent[${request.method}]: incoming params: ${sdk.formatJson(params)}`
  );

  /* Support for A2AClient requests TBD */
  assert(!isClient(_agent), "A2AClient requests are not supported");
  //TODO: This proxy pattern is temporary until we align the A2AClient with the latest protocol changes
  let agent: sdk.A2A.Service = _agent as sdk.A2A.Service;
  if (isClient(_agent)) {
    sdk.logger.debug(`invokeAgent[${request.method}]: creating proxy client`);
    agent = {
      ..._agent,
      streamMessage: async function* (params: sdk.A2A.MessageSendParams) {
        yield* _agent.sendStreamingMessage(params);
      },
      resubscribe: async function* (params: sdk.A2A.TaskIdParams) {
        yield* _agent.resubscribeTask(params);
      },
    } as sdk.A2A.Service;
  }

  const response: RequestAgentRoute["response"] | null = await callAgent(
    request,
    agent,
    params
  );

  if (!response) {
    throw sdk.INTERNAL_ERROR({
      data: {
        message: "Internal error: No response from agent",
        method: request.method,
      },
    });
  }
  return response;
};
