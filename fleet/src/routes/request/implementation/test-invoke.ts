/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod/v4";
import * as sdk from "@artinet/sdk";
import { TestAgentRoute, TestRequestSchema } from "../types/definitions.js";
import { Agent } from "../types/definitions.js";
import { v4 as uuidv4 } from "uuid";

const getId = (request: TestAgentRoute["request"]) => {
  let id = request.id ?? request.agentId;
  if (!id) {
    sdk.logger.debug("No id provided, generating a new one");
    id = uuidv4();
  }
  return id;
};

export const testInvoke = async (
  request: TestAgentRoute["request"],
  _agent: Agent
): Promise<TestAgentRoute["response"] | null> => {
  if (_agent instanceof sdk.A2AClient) {
    throw sdk.INVALID_REQUEST({
      message: "Test agent requests are not supported for A2AClients",
      id: request.id,
      agentId: request.agentId,
    });
  }
  const id = getId(request);
  sdk.logger.info("Invoking test agent: ", { id });

  const testRequest: z.output<typeof TestRequestSchema> =
    await sdk.validateSchema(TestRequestSchema, request.params);

  if (!testRequest || !testRequest.tests || testRequest.tests.length === 0) {
    throw sdk.INVALID_PARAMS({
      message: "Invalid parameters for testing: no tests provided",
      id,
      agentId: request.agentId,
      tests: testRequest.tests,
    });
  }

  sdk.logger.debug(
    `invokeTestAgent[${id}]: incoming tests: ${sdk.formatJson(
      testRequest.tests
    )}`
  );

  const asyncIterable = async function* () {
    for (const test of testRequest.tests) {
      sdk.logger.info(
        `testInvoke[${id}]: starting test: ${test.message.messageId}`
      );
      yield* await _agent.streamMessage(test);
    }
  };

  return {
    type: "stream",
    stream: asyncIterable(),
  };
};
