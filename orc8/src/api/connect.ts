/**
 * @fileoverview
 * Artinet API provider for LLM communication.
 *
 * This module provides the default API provider implementation that connects
 * to the Artinet backend for LLM orchestration. It handles request serialization,
 * response parsing, and error handling for the Connect API.
 *
 * The provider can be configured via environment variables:
 * - `ARTINET_API_URL`: Override the default API endpoint
 *
 * @example
 * ```typescript
 * // Using the default Artinet provider
 * const model = create({
 *   modelId: "gpt-4",
 *   provider: artinetProvider
 * });
 *
 * // Or use as a reference for custom implementations
 * const customProvider: APIProvider = async (request, signal) => {
 *   // Your custom LLM backend logic
 *   return { agentResponse: "..." };
 * };
 * ```
 *
 * @module api/connect
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { API } from "@artinet/types";
import { logger, safeParse, safeParseSchema } from "@artinet/sdk";
import { APIProvider } from "../model-util.js";

/**
 * The Artinet API endpoint URL.
 * Can be overridden via the `ARTINET_API_URL` environment variable.
 */
const PROVIDER_URL =
  process.env.ARTINET_API_URL ?? "https://api.stage.artinet.io/v1/connect";

/**
 * Default API provider implementation using the Artinet backend.
 *
 * Sends requests to the Artinet Connect API for LLM processing,
 * with full support for tool/agent orchestration via the request options.
 *
 * Features:
 * - Automatic request serialization to JSON
 * - Response validation against the ConnectResponse schema
 * - AbortSignal support for request cancellation
 * - Detailed error logging with request context
 *
 * @param request - The connect request containing messages and options
 * @param abortSignal - Optional signal for request cancellation
 * @param headers - Optional custom headers (defaults include CORS headers)
 * @returns Promise resolving to the validated connect response
 * @throws {Error} If the API request fails or response is invalid
 *
 * @example
 * ```typescript
 * const response = await artinetProvider({
 *   identifier: "gpt-4",
 *   messages: [{ role: "user", content: "Hello!" }],
 *   options: {
 *     tools: { services: [...] },
 *     agents: { services: [...] }
 *   }
 * });
 * console.log(response.agentResponse);
 * ```
 */
export const artinetProvider: APIProvider = async (
  request: API.ConnectRequest,
  abortSignal?: AbortSignal,
  headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Credentials": "true",
  }
): Promise<API.ConnectResponse> => {
  throw new Error("The artinet API is currently in a closed beta. Please use the openai Provider or contact us to get access.");
  const restResponse = await fetch(PROVIDER_URL, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(request),
    signal: abortSignal,
  });

  if (!restResponse.ok) {
    const text = await restResponse.text();
    const error = new Error(
      `Failed to fetch agent response: ${restResponse.statusText} ${
        restResponse.status
      } ${text ?? ""}`
    );
    logger.error(
      `[${request.identifier}:${request.preferredEndpoint}]: ${error.message}`,
      error
    );
    throw error;
  }

  const text = await restResponse.text();
  const json = safeParse(text).data ?? {};
  return await safeParseSchema(json?.body, API.ConnectResponseSchema);
};
