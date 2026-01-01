/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as hono from "hono";
import * as sdk from "@artinet/sdk";
import {
  CreateAgent,
  CreateAgentRoute,
  CreateAgentRequestSchema,
} from "../../routes/create/index.js";
import { generateRequestId, generateRegistrationId } from "./utils.js";

export type handler = (
  ctx: hono.Context,
  next: hono.Next,
  context: CreateAgentRoute["context"],
  deploy?: CreateAgentRoute["implementation"]
) => Promise<void>;

export async function handle(
  ctx: hono.Context,
  _next: hono.Next,
  context: CreateAgentRoute["context"],
  deploy: CreateAgentRoute["implementation"] = CreateAgent
): Promise<void> {
  /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
  const req = sdk.safeParse(await ctx.req.text());
  sdk.logger.warn(`handle deploy request with body: ${JSON.stringify(req)}`);
  const request: CreateAgentRoute["request"] = await sdk.validateSchema(
    CreateAgentRequestSchema,
    req
  );
  context.registrationId = generateRegistrationId(request.config.uri);
  const result: CreateAgentRoute["response"] = await deploy(request, context);
  ctx.res = ctx.json(result);
}

export const factory =
  (deploy: CreateAgentRoute["implementation"] = CreateAgent): handler =>
  async (
    ctx: hono.Context,
    next: hono.Next,
    context: CreateAgentRoute["context"]
  ) =>
    await handle(ctx, next, context, deploy);

export interface Params {
  ctx: hono.Context;
  next: hono.Next;
  context: CreateAgentRoute["context"];
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
  const reqId =
    ctx.req.header("x-request-id") ?? sdk.safeParse(await ctx.req.text())?.id;
  const requestContext: CreateAgentRoute["context"] = {
    ...context,
    requestId: generateRequestId(context, reqId),
    userId: await user?.(ctx),
  };
  await handler(ctx, next, requestContext);
}
