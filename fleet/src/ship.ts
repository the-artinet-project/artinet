/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreateAgentRoute } from "./routes/create/index.js";
import * as sdk from "@artinet/sdk";
import * as armada from "@artinet/armada";
import { API } from "@artinet/types";

export async function ship<T extends CreateAgentRoute["request"]>(
  fleetUrl: string = "http://localhost:3000",
  request: T
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
    },
    body: JSON.stringify(requestBody),
  });
  return await sdk.validateSchema(
    API.CreateAgentResponseSchema,
    await response.json()
  );
}
