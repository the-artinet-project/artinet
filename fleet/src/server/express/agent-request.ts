/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { INVALID_REQUEST } from "@artinet/sdk";
import express from "express";
import {
  RequestAgent,
  RequestAgentRoute,
  RequestContext,
} from "../../routes/request/index.js";
import * as sdk from "@artinet/sdk";
import { handleJSONRPCResponse } from "./rpc.js";
import { generateRequestId } from "./utils.js";
export const AGENT_FIELD_NAME = "agentId";

export type handler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  context: RequestContext,
  request?: RequestAgentRoute["implementation"],
  intercepts?: RequestAgentRoute["intercept"][]
) => Promise<void>;

export async function handle(
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
  context: RequestContext,
  request: RequestAgentRoute["implementation"] = RequestAgent,
  intercepts?: RequestAgentRoute["intercept"][]
): Promise<void> {
  const requestId: string = generateRequestId(context, req);
  let parsed: sdk.A2A.A2ARequest;

  if (
    req?.path?.endsWith("agent-card.json") ||
    req?.path?.endsWith("agent.json")
  ) {
    parsed = {
      jsonrpc: "2.0",
      id: requestId,
      method: "agentcard/get",
      params: null,
    } as unknown as sdk.A2A.A2ARequest;
  } else {
    parsed = await sdk.validateSchema(
      sdk.A2A.A2ARequestSchema,
      req?.body ?? {}
    );
  }

  const params: sdk.A2A.RequestParam = await sdk.validateSchema(
    sdk.A2A.RequestParamSchema,
    parsed.params
  );

  const agentRequest: RequestAgentRoute["request"] = {
    method: parsed.method,
    params: params,
  };

  sdk.logger.info(
    `handle agent request received:${parsed.method}:params:${sdk.formatJson(
      agentRequest
    )}`
  );

  const response: RequestAgentRoute["response"] = await request(
    agentRequest,
    context,
    intercepts
  );

  sdk.logger.info(
    `handle agent request completed:${parsed.method}:response:${sdk.formatJson(
      response
    )}`
  );
  await handleJSONRPCResponse(res, requestId, parsed.method, response);
}

export const factory =
  (
    request: RequestAgentRoute["implementation"] = RequestAgent,
    intercepts?: RequestAgentRoute["intercept"][]
  ): handler =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    context: RequestContext
  ) =>
    await handle(req, res, next, context, request, intercepts);

/**
 * Handler utilities for agent HTTP requests.
 *
 * Exports a reusable handler function for routing requests to agent instances,
 * verifying agentId route param, and returning agent metadata
 * or dispatching to JSON-RPC middleware as appropriate.
 *
 * Used by the deployment server to provide a standard agent endpoint interface.
 *
 * @module server/handlers/agent
 */

export interface Params {
  request: express.Request;
  response: express.Response;
  next: express.NextFunction;
  context: Omit<RequestContext, "agentId">;
  handler: handler;
  user: (request: express.Request) => Promise<string>;
}

export async function request({
  request: req,
  response: res,
  next,
  context,
  handler = handle,
  user,
}: Params): Promise<void> {
  const agentId: string = Array.isArray(req?.params?.[AGENT_FIELD_NAME])
    ? req?.params?.[AGENT_FIELD_NAME][0]
    : req?.params?.[AGENT_FIELD_NAME];
  if (!agentId) {
    return next(
      INVALID_REQUEST({ message: `${AGENT_FIELD_NAME} is required` })
    );
  }
  const requestContext: RequestContext = {
    ...context,
    agentId,
    requestId: generateRequestId(context, req),
    userId: await user?.(req),
  };

  await handler(req, res, next, requestContext);
}
