/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreateAgentRoute } from "./routes/create/index.js";
import * as sdk from "@artinet/sdk";
import * as armada from "@artinet/armada";
import { API } from "@artinet/types";

/**
 * Deploys an agent configuration to a remote Fleet server.
 *
 * This function serves as a client for agent deployment,
 * implementing schema validation on both request and response to ensure type safety
 * and data integrity across network boundaries.
 *
 * @see {@link https://zod.dev/ Zod Schema Validation}
 *
 * Schema validation will throw if the request or response doesn't match the expected
 * structure. Network errors from `fetch` will propagate as-is.
 *
 * @template T - The agent request type, constrained to `CreateAgentRoute["request"]`
 *
 * @param fleetUrl - Base URL of the Fleet server. Defaults to `http://localhost:3000`
 *   for local development. In production, use environment variables.
 * @param request - Agent configuration to deploy. Must conform to {@link armada.CreateAgentRequestSchema}.
 * @param headers - Optional custom HTTP headers to include with the request. Useful for authentication tokens, correlation IDs, or distributed tracing headers.
 *
 * @returns Promise resolving to the deployment response, validated against {@link API.CreateAgentResponseSchema}.
 *
 * @example
 * ```typescript
 * // Deploy to local development server
 * const result = await ship("http://localhost:3000", {
 *   config: {
 *     schemaVersion: "0.1.0",
 *     uri: "my-agent",
 *     name: "My Agent",
 *     description: "A helpful assistant",
 *     modelId: "gpt-4",
 *     instructions: "You are a helpful assistant.",
 *     version: "1.0.0",
 *   },
 * });
 *
 * // Deploy with authentication header
 * const authResult = await ship(
 *   process.env.FLEET_URL!,
 *   agentConfig,
 *   { Authorization: `Bearer ${token}` }
 * );
 * ```
 */
export async function ship<T extends CreateAgentRoute["request"]>(
  fleetUrl: string = "http://localhost:3000",
  request: T,
  headers: Record<string, string> = {}
): Promise<CreateAgentRoute["response"]> {
  const requestBody = await sdk.validateSchema(
    armada.CreateAgentRequestSchema,
    request
  );
  sdk.logger.debug(`deployAgent request:`, { requestBody });
  const response = await fetch(`${fleetUrl}/deploy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(requestBody),
  });
  return await sdk.validateSchema(
    API.CreateAgentResponseSchema,
    await response.json()
  );
}
