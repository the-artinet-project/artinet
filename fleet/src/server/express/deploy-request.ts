/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import {
  CreateAgent,
  CreateAgentRoute,
  CreateAgentRequestSchema,
} from "../../routes/create/index.js";
import { generateRequestId, generateRegistrationId } from "./utils.js";
import { logger, validateSchema, formatJson } from "@artinet/sdk";

export type handler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  context: CreateAgentRoute["context"],
  deploy?: CreateAgentRoute["implementation"]
) => Promise<void>;

export async function handle(
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
  context: CreateAgentRoute["context"],
  deploy: CreateAgentRoute["implementation"] = CreateAgent
): Promise<void> {
  const request: CreateAgentRoute["request"] = await validateSchema(
    CreateAgentRequestSchema,
    req?.body ?? {}
  );

  logger.info(`deploying agent: ${request.config.name}`);
  logger.debug(`deploying agent: ${formatJson(request)}`);

  context.registrationId = generateRegistrationId(request.config.uri);
  const result: CreateAgentRoute["response"] = await deploy(request, context);
  res.json(result);
}

export const factory =
  (deploy: CreateAgentRoute["implementation"] = CreateAgent): handler =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    context: CreateAgentRoute["context"]
  ) =>
    await handle(req, res, next, context, deploy);

export interface Params {
  request: express.Request;
  response: express.Response;
  next: express.NextFunction;
  context: CreateAgentRoute["context"];
  handler: handler;
  user: (req: express.Request) => Promise<string>;
}

export async function request({
  request: req,
  response: res,
  next,
  context,
  handler = handle,
  user,
}: Params): Promise<void> {
  const requestContext: CreateAgentRoute["context"] = {
    ...context,
    requestId: generateRequestId(context, req),
    userId: await user?.(req),
  };
  return await handler(req, res, next, requestContext);
}
