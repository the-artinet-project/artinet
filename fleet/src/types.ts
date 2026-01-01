/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestAgentRoute, TestAgentRoute } from "./routes/index.js";
import { CreateAgentRoute } from "./routes/create/index.js";

export type Config = RequestAgentRoute["context"] &
  CreateAgentRoute["context"] &
  TestAgentRoute["context"];

export type Configuration = Omit<Config, "agentId">;

export type ResultOrError<
  Result = unknown,
  Error = unknown,
  Stream = unknown
> =
  | {
      type: "success";
      result: Result;
    }
  | {
      type: "error";
      error: Error;
    }
  | {
      type: "stream";
      stream: AsyncIterable<Stream>;
    };
