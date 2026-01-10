/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import { RequestAgentRoute, TestAgentRoute } from "./types/definitions.js";
import { FetchAgent } from "./interceptors/fetch-agent.js";
import { GetAgents } from "./interceptors/get-agents.js";
import { requestImplementation } from "./implementation/request.js";

const DEFAULT_INTERCEPTS = [FetchAgent, GetAgents];

export const requestAgent = (
  request: RequestAgentRoute["request"],
  context: RequestAgentRoute["context"],
  requestFn: RequestAgentRoute["implementation"] = requestImplementation,
  intercepts: RequestAgentRoute["intercept"][] = []
): Promise<RequestAgentRoute["response"]> =>
  armada.entry<
    RequestAgentRoute["request"],
    RequestAgentRoute["response"],
    RequestAgentRoute["context"]
  >({
    request,
    implementation: requestFn,
    intercepts: [...DEFAULT_INTERCEPTS, ...intercepts],
    context,
  });

export const RequestAgent: RequestAgentRoute["implementation"] = (
  request: RequestAgentRoute["request"],
  context: RequestAgentRoute["context"],
  intercepts: RequestAgentRoute["intercept"][] = []
): Promise<RequestAgentRoute["response"]> =>
  requestAgent(request, context, requestImplementation, intercepts);

/**
 * Test agent implementation.
 * @note Similar to RequestAgent, but skips the FetchAgent intercept and uses the testInvoke function that returns a stream of updates.
 */
export const TestAgent: TestAgentRoute["implementation"] = (
  request: TestAgentRoute["request"],
  context: TestAgentRoute["context"]
): Promise<TestAgentRoute["response"]> =>
  requestAgent(request, context, requestImplementation);
