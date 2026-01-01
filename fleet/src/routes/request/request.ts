/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import { RequestAgentRoute, TestAgentRoute } from "./types/definitions.js";
import { FetchAgent } from "./interceptors/fetch-agent.js";
import { GetAgents } from "./interceptors/get-agents.js";
import { requestImplementation } from "./implementation/request.js";

export const requestAgent = (
  request: RequestAgentRoute["request"],
  context: RequestAgentRoute["context"],
  requestFn: RequestAgentRoute["implementation"] = requestImplementation
): Promise<RequestAgentRoute["response"]> =>
  armada.entry<
    RequestAgentRoute["request"],
    RequestAgentRoute["response"],
    RequestAgentRoute["context"]
  >({
    request,
    implementation: requestFn,
    intercepts: [FetchAgent, GetAgents],
    context,
  });

export const RequestAgent: RequestAgentRoute["implementation"] = (
  request: RequestAgentRoute["request"],
  context: RequestAgentRoute["context"]
): Promise<RequestAgentRoute["response"]> =>
  requestAgent(request, context, requestImplementation);

/**
 * Test agent implementation.
 * @note Similar to RequestAgent, but skips the FetchAgent intercept and uses the testInvoke function that returns a stream of updates.
 */
export const TestAgent: TestAgentRoute["implementation"] = (
  request: TestAgentRoute["request"],
  context: TestAgentRoute["context"]
): Promise<TestAgentRoute["response"]> =>
  requestAgent(request, context, requestImplementation);
