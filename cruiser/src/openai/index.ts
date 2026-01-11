/**
 * @fileoverview openai → artinet
 *
 * @module @artinet/cruiser/openai
 * @description
 * This adapter "parks" {@link OpenAIAgent | OpenAI Agents} (from `@openai/agents`) into the
 * artinet, enabling them to participate in multi-agent workflows.
 *
 * ## Design Decisions
 *
 * 1. **Execution Model**: OpenAI uses {@link run | `run(agent, input)`} instead of `agent.generate()`.
 *    The `run` function handles the full agent loop including tool calls and handoffs.
 *
 * 2. **Message History**: Converts {@link sdk.A2A.Message} to OpenAI's {@link AgentInputItem} format,
 *    preserving conversation context across interactions.
 *
 * 3. **Result Handling**: Extracts {@link RunResult | `RunResult.finalOutput`} which can be either
 *    a string or structured output depending on agent configuration.
 *
 * 4. **Options Passthrough**: Uses {@link NonStreamRunOptions} for execution configuration
 *    including maxTurns, abort signals, and callbacks.
 *
 * ## Usage
 *
 * ```typescript
 * import { Agent } from "@openai/agents";
 * import { park } from "@artinet/cruiser/openai";
 * import { serve } from "@artinet/sdk";
 *
 * const openaiAgent = new Agent({
 *   name: "assistant",
 *   instructions: "You are a helpful assistant",
 * });
 *
 * const artinetAgent = await park(openaiAgent, { name: "My Assistant" });
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://platform.openai.com/docs/agents} OpenAI Agents Documentation
 */

import {
  Agent as OpenAIAgent,
  run,
  NonStreamRunOptions,
  TextOutput,
} from "@openai/agents";
import * as sdk from "@artinet/sdk";
import { Park } from "../corsair.js";
import {
  getAgentCard,
  convertToAgentInputItem,
  extractA2AMessage,
} from "./utils.js";

/**
 * Configuration options for OpenAI agent execution.
 *
 * Directly exposes OpenAI's {@link NonStreamRunOptions} for familiarity with
 * developers already using the OpenAI Agents SDK.
 *
 * @see {@link NonStreamRunOptions} from `@openai/agents`
 */
export type OpenAIParkOptions = NonStreamRunOptions<unknown>;

/**
 * Parks an {@link OpenAIAgent} onto artinet.
 *
 * Transforms an OpenAI Agent instance into an {@link sdk.Agent | A2A-compatible agent}
 * that can be deployed on artinet and communicate with other A2A agents.
 *
 * @param agent - The {@link OpenAIAgent} to park
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize identity and capabilities
 * @param options - Optional {@link OpenAIParkOptions} (maxTurns, signal, hooks, etc.)
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example Basic Usage
 * ```typescript
 * import { park } from "@artinet/cruiser/openai";
 * import { Agent } from "@openai/agents";
 *
 * const agent = new Agent({
 *   name: "helper",
 *   instructions: "You are a helpful assistant",
 * });
 *
 * const artinetAgent = await park(agent, { name: "Helper Bot" });
 * ```
 *
 * @example With Tools
 * ```typescript
 * import { park } from "@artinet/cruiser/openai";
 * import { Agent, tool } from "@openai/agents";
 * import { z } from "zod";
 *
 * const searchTool = tool({
 *   name: "search",
 *   description: "Search the web",
 *   parameters: z.object({ query: z.string() }),
 *   execute: async ({ query }) => searchWeb(query),
 * });
 *
 * const agent = new Agent({
 *   name: "researcher",
 *   instructions: "Help users find information",
 *   tools: [searchTool],
 * });
 *
 * const artinetAgent = await park(agent, { name: "Research Bot" });
 * ```
 *
 * @example With Execution Options
 * ```typescript
 * import { park } from "@artinet/cruiser/openai";
 * import { Agent } from "@openai/agents";
 *
 * const agent = new Agent({
 *   name: "helper",
 *   instructions: "You are a helpful assistant",
 * });
 *
 * const artinetAgent = await park(
 *   agent,
 *   { name: "Limited Agent" },
 *   {
 *     maxTurns: 5,                    // Limit agentic loops
 *     signal: abortController.signal, // Support cancellation
 *   },
 * );
 * ```
 */
export const park: Park<OpenAIAgent, OpenAIParkOptions> = async (
  agent: OpenAIAgent<unknown, TextOutput>,
  card?: sdk.A2A.AgentCardParams,
  options?: OpenAIParkOptions
): Promise<sdk.Agent> => {
  const agentCard = await getAgentCard({ agent, card });
  sdk.logger.debug(`OpenAI[${agent.name}]:[card:${JSON.stringify(agentCard)}]`);

  return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
    sdk.logger.debug(
      `OpenAI[${agent.name}]:[context:${context.contextId}]: starting`
    );

    const task = await context.getTask();

    const history: sdk.A2A.Message[] = sdk.getLatestHistory(task);
    history.push(context.userMessage);

    const input = history.map(convertToAgentInputItem);
    const result = await run(agent, input, options);
    const responseMessage = extractA2AMessage(
      context.taskId,
      context.contextId,
      result
    );

    const metadata = {
      ...(task.metadata ?? {}),
      result: {
        ...result,
      },
    };

    const completedUpdate: sdk.A2A.TaskStatusUpdateEvent =
      sdk.describe.update.completed({
        taskId: context.taskId,
        contextId: context.contextId,
        message: responseMessage,
        metadata,
      });

    yield completedUpdate;
  });
};
