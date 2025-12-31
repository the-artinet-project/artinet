/**
 * @fileoverview
 * OpenAI provider for the Artinet Orchestrator.
 *
 * Provides a function to create an OpenAI provider for the Artinet Orchestrator.
 *
 * @module api/openai
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import openai, { ClientOptions, OpenAI } from "openai";
import { APIProvider } from "../model-util.js";
import { API } from "@artinet/types";
import { logger, formatJson } from "@artinet/sdk";
import { openaiRequest, artinetResponse } from "./openai-util.js";

/**
 * Creates an APIProvider that uses OpenAI for completions.
 *
 * Handles the full conversion pipeline:
 * 1. Converts Artinet request to OpenAI format
 * 2. Calls OpenAI API
 * 3. Converts response back to Artinet format
 *
 * @param client - OpenAI client instance or client options
 * @returns An APIProvider function for use with the orchestrator
 *
 * @example
 * ```typescript
 * import { create } from "@artinet/orchestrator";
 * import { openaiProvider } from "@artinet/orchestrator/api/openai";
 *
 * const model = create({
 *   modelId: "gpt-4",
 *   provider: openaiProvider({ apiKey: process.env.OPENAI_API_KEY }),
 * });
 * ```
 */
export function openaiProvider(client: OpenAI | ClientOptions): APIProvider {
  const openaiClient = client instanceof OpenAI ? client : new OpenAI(client);

  return async (
    request: API.ConnectRequest,
    abortSignal?: AbortSignal
  ): Promise<API.ConnectResponse> => {
    const { params, uriMap } = openaiRequest(request);
    logger.debug("openaiProvider:Request:", formatJson(params));

    const completion: openai.ChatCompletion =
      await openaiClient.chat.completions.create(params, {
        signal: abortSignal,
      });
    logger.debug("openaiProvider:Completion:", formatJson(completion));

    return artinetResponse(completion, uriMap);
  };
}
