/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sdk from "@artinet/sdk";
import * as hono from "hono";
import escapeHtml from "escape-html";
import { A2AError } from "@a2a-js/sdk/server";
/**
 * Express error handler middleware.
 */
export const errorHandler: hono.ErrorHandler = async (err, ctx) => {
  sdk.logger.error("errorHandler", err);
  /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
  const body = sdk.safeParse(await ctx.req.text());
  let reqId = null;
  try {
    if (body && typeof body === "object" && "id" in body) {
      reqId = body.id;
    }
  } catch (e: unknown) {
    sdk.logger.error("errorHandler: Error extracting request ID", e);
  }
  let jsonRpcError: sdk.MCP.JSONRPCErrorResponse["error"];
  if (err instanceof A2AError || err instanceof sdk.SystemError) {
    jsonRpcError = { code: err.code, message: err.message, data: err.data };
  } else {
    jsonRpcError = A2AError.internalError(err.message, {
      cause: err.cause ?? err.stack,
    }).toJSONRPCError();
  }
  const errorResponse = {
    jsonrpc: "2.0",
    id: escapeHtml(reqId),
    error: jsonRpcError,
  };
  ctx.status(500);
  const res = ctx.json(errorResponse);
  return res;
};
