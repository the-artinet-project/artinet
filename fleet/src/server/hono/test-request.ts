/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sdk from "@artinet/sdk";
import * as hono from "hono";
import {
  TestAgent,
  TestAgentRoute,
  TestRequestSchema,
  TestRequest,
} from "../../routes/request/index.js";
import { v4 as uuidv4 } from "uuid";
import { handleJSONRPCResponse } from "./rpc.js";
import { generateRequestId } from "./utils.js";

export type handler = (
  ctx: hono.Context,
  next: hono.Next,
  context: TestAgentRoute["context"],
  test?: TestAgentRoute["implementation"]
) => Promise<void>;

export async function handle(
  ctx: hono.Context,
  _next: hono.Next,
  context: TestAgentRoute["context"],
  test: TestAgentRoute["implementation"] = TestAgent
): Promise<void> {
  /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
  const req = sdk.safeParse(await ctx.req.text());
  let parsed: Omit<TestRequest, "method" | "params"> = await sdk.validateSchema(
    TestRequestSchema,
    req
  );

  let id = parsed.id ?? uuidv4();
  parsed.id = id;

  let request: TestAgentRoute["request"] = parsed as TestAgentRoute["request"];
  context.target = parsed.config;
  request.method = "test/invoke";
  request.params = null;

  const response: TestAgentRoute["response"] = await test(request, context);

  await handleJSONRPCResponse(ctx, String(id), request.method, response);
}

export const factory =
  (test: TestAgentRoute["implementation"] = TestAgent): handler =>
  async (
    ctx: hono.Context,
    next: hono.Next,
    context: TestAgentRoute["context"]
  ) =>
    await handle(ctx, next, context, test);

const MAX_TEST_ID_ATTEMPTS = 10;
const getTestId = async (
  context: Omit<TestAgentRoute["context"], "agentId">
) => {
  let testId = uuidv4();
  let free = false;
  for (let i = 0; i < MAX_TEST_ID_ATTEMPTS; i++) {
    if (await context.storage.get(testId)) {
      testId = uuidv4();
    } else {
      free = true;
      break;
    }
  }
  if (!free) {
    throw sdk.INTERNAL_ERROR({
      message: `Failed to find a free test agent ID after ${MAX_TEST_ID_ATTEMPTS} attempts`,
      id: testId,
    });
  }
  return testId;
};

export interface Params {
  ctx: hono.Context;
  next: hono.Next;
  context: Omit<TestAgentRoute["context"], "agentId">;
  handler: handler;
  user: (ctx: hono.Context) => Promise<string>;
}

export async function request({
  ctx,
  next,
  context,
  handler = handle,
  user,
}: Params): Promise<hono.Context["res"]> {
  /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
  const reqId =
    ctx.req.header("x-request-id") ?? sdk.safeParse(await ctx.req.text())?.id;
  const requestContext: TestAgentRoute["context"] = {
    ...context,
    agentId: await getTestId(context),
    requestId: generateRequestId(context, reqId),
    userId: await user?.(ctx),
  };
  await handler(ctx, next, requestContext);
  return ctx.res;
}
