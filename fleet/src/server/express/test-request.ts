import * as sdk from "@artinet/sdk";
import express from "express";
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
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  context: TestAgentRoute["context"],
  test?: TestAgentRoute["implementation"]
) => Promise<void>;

export async function handle(
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
  context: TestAgentRoute["context"],
  test: TestAgentRoute["implementation"] = TestAgent
): Promise<void> {
  let parsed: Omit<TestRequest, "method" | "params"> = await sdk.validateSchema(
    TestRequestSchema,
    req?.body ?? {}
  );

  let id = parsed.id ?? uuidv4();
  parsed.id = id;

  let request: TestAgentRoute["request"] = parsed as TestAgentRoute["request"];
  context.target = parsed.config;
  request.method = "test/invoke";
  request.params = null;

  const response: TestAgentRoute["response"] = await test(request, context);

  await handleJSONRPCResponse(res, String(id), request.method, response);
}

export const factory =
  (test: TestAgentRoute["implementation"] = TestAgent): handler =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    context: TestAgentRoute["context"]
  ) =>
    await handle(req, res, next, context, test);

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
  request: express.Request;
  response: express.Response;
  next: express.NextFunction;
  context: Omit<TestAgentRoute["context"], "agentId">;
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
  const requestContext: TestAgentRoute["context"] = {
    ...context,
    agentId: await getTestId(context),
    requestId: generateRequestId(context, req),
    userId: await user?.(req),
  };
  return await handler(req, res, next, requestContext);
}
