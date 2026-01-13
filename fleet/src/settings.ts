/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestAgentRoute, TestAgentRoute } from "./routes/index.js";
import { CreateAgentRoute } from "./routes/create/index.js";
import { Configuration } from "./types.js";
import { Middleware } from "./routes/intercept.js";

/**
 * Route path configuration parameters for the Fleet server.
 *
 * Extends {@link Configuration} with customizable URL paths for each endpoint,
 * allowing flexible integration with existing API structures.
 */
export interface Params extends Configuration {
  /** Base path prefix for all Fleet routes. Defaults to `/`. */
  basePath?: string;
  /** Fallback path for agent requests. Defaults to `/.well-known/agent`. */
  fallbackPath?: string;
  /** Path for agent deployment requests. Defaults to `/deploy`. */
  deploymentPath?: string;
  /** Path for agent test/evaluation requests. Defaults to `/test`. */
  testPath?: string;
  /** Middleware addons are currently only supported on the Request Agent route. */
  middleware?: Middleware;
}

/**
 * Complete settings combining route paths with handler implementations.
 *
 * Defines the core operations for agent management:
 * - `get`: Retrieve and execute agent requests
 * - `set`: Deploy new agents or update existing ones
 * - `test`: Evaluate agent behavior (optional)
 */
export interface Settings extends Params {
  /** Implementation for retrieving and processing agent requests. */
  get: RequestAgentRoute["implementation"];
  /** Implementation for deploying or updating agents. */
  set: CreateAgentRoute["implementation"];
  /** Implementation for testing/evaluating agents. Optional. */
  test?: TestAgentRoute["implementation"];
}
