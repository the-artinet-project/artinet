/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { INVALID_REQUEST } from "@artinet/sdk";
import * as hono from "hono";
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
  ctx: hono.Context,
  next: hono.Next,
  context: RequestContext,
  request?: RequestAgentRoute["implementation"],
  intercepts?: RequestAgentRoute["intercept"][]
) => Promise<void>;

export async function handle(
  ctx: hono.Context,
  _next: hono.Next,
  context: RequestContext,
  request: RequestAgentRoute["implementation"] = RequestAgent,
  intercepts?: RequestAgentRoute["intercept"][]
): Promise<void> {
  /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
  const body = sdk.safeParse(await ctx.req.text());
  const requestId: string = generateRequestId(
    context,
    ctx.req.header("x-request-id") ?? body?.id
  );
  let parsed: sdk.A2A.A2ARequest;

  if (
    ctx.req.path.endsWith("agent-card.json") ||
    ctx.req.path.endsWith("agent.json")
  ) {
    parsed = {
      jsonrpc: "2.0",
      id: requestId,
      method: "agentcard/get",
      params: null,
    } as unknown as sdk.A2A.A2ARequest;
  } else {
    parsed = await sdk.validateSchema(sdk.A2A.A2ARequestSchema, body ?? {});
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

  await handleJSONRPCResponse(ctx, requestId, parsed.method, response);
}

export const factory =
  (
    request: RequestAgentRoute["implementation"] = RequestAgent,
    intercepts?: RequestAgentRoute["intercept"][]
  ): handler =>
  async (ctx: hono.Context, next: hono.Next, context: RequestContext) =>
    await handle(ctx, next, context, request, intercepts);

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
  ctx: hono.Context;
  next: hono.Next;
  context: Omit<RequestContext, "agentId">;
  handler: handler;
  user: (ctx: hono.Context) => Promise<string>;
}

export async function request({
  ctx,
  next,
  context,
  handler = handle,
  user,
}: Params): Promise<void> {
  const agentId: string = ctx.req.param(AGENT_FIELD_NAME);
  if (!agentId) {
    throw INVALID_REQUEST({ message: `${AGENT_FIELD_NAME} is required` });
  }
  /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
  const reqId =
    ctx.req.header("x-request-id") ?? sdk.safeParse(await ctx.req.text())?.id;

  const requestContext: RequestContext = {
    ...context,
    agentId,
    requestId: generateRequestId(context, reqId),
    userId: await user?.(ctx),
  };

  await handler(ctx, next, requestContext);
}
