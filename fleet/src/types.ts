/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestAgentRoute, TestAgentRoute } from "./routes/index.js";
import { CreateAgentRoute } from "./routes/create/index.js";

/**
 * Combined context type for all route handlers.
 *
 * Represents the intersection of context requirements across agent request,
 * creation, and testing routes. Used internally for handler type safety.
 */
export type Config = RequestAgentRoute["context"] &
  CreateAgentRoute["context"] &
  TestAgentRoute["context"];

/**
 * Configuration type without agent-specific identifiers.
 *
 * Omits `agentId` from {@link Config} for use in settings and initialization
 * where the agent ID is not yet known.
 */
export type Configuration = Omit<Config, "agentId">;

/**
 * Discriminated union for operation results.
 *
 * Provides a type-safe way to represent three possible outcomes:
 * - `success`: Operation completed with a result
 * - `error`: Operation failed with an error
 * - `stream`: Operation returns an async iterable stream
 *
 * @see {@link https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions Discriminated Unions}
 *
 * @template Result - Type of successful result. Defaults to `unknown`.
 * @template Error - Type of error payload. Defaults to `unknown`.
 * @template Stream - Type of streamed items. Defaults to `unknown`.
 *
 * @example
 * ```typescript
 * function handle(result: ResultOrError<User, ApiError, Chunk>) {
 *   switch (result.type) {
 *     case "success": return result.result; // User
 *     case "error": throw result.error;     // ApiError
 *     case "stream": return result.stream;  // AsyncIterable<Chunk>
 *   }
 * }
 * ```
 */
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
