/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestAgentRoute, TestAgentRoute } from "./routes/index.js";
import { CreateAgentRoute } from "./routes/create/index.js";
import { Configuration } from "./types.js";
import { Middleware } from "./routes/intercept.js";

export interface Params extends Configuration {
  basePath?: string;
  fallbackPath?: string;
  deploymentPath?: string;
  testPath?: string;
  /**Middleware addons are currently only supported on the Request Agent route */
  middleware?: Middleware;
}

export interface Settings extends Params {
  get: RequestAgentRoute["implementation"];
  set: CreateAgentRoute["implementation"];
  test?: TestAgentRoute["implementation"];
}
