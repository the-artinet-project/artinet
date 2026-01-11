/**
 * @fileoverview mastra → artinet
 *
 * @module @artinet/cruiser/mastra
 * @description
 * This adapter "parks" {@link MastraAgent | Mastra agents} onto artinet,
 * enabling them to participate in multi-agent workflows. Mastra is a TypeScript-first
 * AI framework with built-in memory, workflows, and tool support.
 *
 * ## Design Decisions
 *
 * 1. **Thread Management**: Uses contextId as Mastra's threadId for conversation
 *    continuity across multiple interactions.
 *
 * 2. **Resource Binding**: Supports resourceId from task metadata, context metadata,
 *    or user message metadata for Mastra's resource-based memory.
 *
 * 3. **Execution Metadata**: Captures tool calls, results, usage stats, and finish
 *    reason in task metadata for observability.
 *
 * 4. **Output Flexibility**: Supports both AI SDK and Mastra output formats via
 *    the {@link AgentExecutionOptions} type parameter.
 *
 * ## Usage
 *
 * ```typescript
 * import { Agent } from "@mastra/core/agent";
 * import { park } from "@artinet/cruiser/mastra";
 * import { serve } from "@artinet/sdk";
 *
 * const mastraAgent = new Agent({
 *   name: "assistant",
 *   instructions: "You are a helpful assistant",
 *   model: openai("gpt-4"),
 * });
 *
 * const artinetAgent = await park(mastraAgent, { name: "My Assistant" });
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://mastra.ai/docs} Mastra Documentation
 */

import { OutputSchema } from "@mastra/core/stream";
import {
  Agent as MastraAgent,
  AgentExecutionOptions,
} from "@mastra/core/agent";
import * as sdk from "@artinet/sdk";
import { getAgentCard, convertToCoreMessage } from "./utils.js";
import { v4 as uuidv4 } from "uuid";
import { Park } from "../corsair.js";

/**
 * Parks a Mastra agent onto artinet.
 *
 * Transforms a {@link MastraAgent} instance into an {@link sdk.Agent | A2A-compatible agent}
 * that can be deployed on artinet. Preserves Mastra's thread-based memory by
 * mapping context IDs to Mastra thread IDs.
 *
 * @param agent - The {@link MastraAgent} instance to park
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize identity and capabilities
 * @param options - Optional {@link AgentExecutionOptions} for execution (output schema, format, etc.)
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example Basic Usage
 * ```typescript
 * import { park } from "@artinet/cruiser/mastra";
 * import { Agent } from "@mastra/core/agent";
 *
 * const agent = new Agent({
 *   name: "helper",
 *   instructions: "Be helpful",
 *   model: openai("gpt-4"),
 * });
 *
 * const artinetAgent = await park(agent, { name: "Helper Bot" });
 * ```
 *
 * @example With Structured Output
 * ```typescript
 * import { park } from "@artinet/cruiser/mastra";
 * import { z } from "zod";
 *
 * const responseSchema = z.object({
 *   answer: z.string(),
 *   confidence: z.number(),
 * });
 *
 * const artinetAgent = await park(
 *   myAgent,
 *   { name: "Structured Agent" },
 *   { output: responseSchema }
 * );
 * ```
 *
 * @example With Tools
 * ```typescript
 * import { park } from "@artinet/cruiser/mastra";
 *
 * const agentWithTools = new Agent({
 *   name: "research-bot",
 *   instructions: "Help users research topics",
 *   model: openai("gpt-4"),
 *   tools: { webSearch, summarize, saveNote },
 * });
 *
 * const artinetAgent = await park(agentWithTools, {
 *   name: "Research Assistant",
 *   description: "AI-powered research helper",
 * });
 * ```
 */
export const park: Park<
  MastraAgent,
  AgentExecutionOptions<OutputSchema | undefined, "aisdk" | "mastra">
> = async (
  agent: MastraAgent,
  card?: sdk.A2A.AgentCardParams,
  options?: AgentExecutionOptions<OutputSchema | undefined, "aisdk" | "mastra">
): Promise<sdk.Agent> => {
  /**No need to segregate tasks between agents */
  const agentCard = await getAgentCard({ agent, card, options });
  sdk.logger.debug(`Mastra[${agent.id}]:[card:${JSON.stringify(agentCard)}]`);
  return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
    sdk.logger.debug(
      `Mastra[${agent.id}]:[context:${context.contextId}]: starting`
    );
    const task = await context.getTask();

    const messages: sdk.A2A.Message[] = sdk.getLatestHistory(task);

    const resourceId =
      (task.metadata?.resourceId as string) ??
      (context.metadata?.resourceId as string) ??
      (context.userMessage.metadata?.resourceId as string) ??
      agent.id;

    const result = await agent.generate(messages.map(convertToCoreMessage), {
      runId: task.id,
      ...options,
      ...(context.contextId ? { threadId: context.contextId, resourceId } : {}),
    });

    const metadata = {
      ...(task.metadata ?? {}),
      execution: {
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        usage: result.usage,
        finishReason: result.finishReason,
      },
    };
    const completedUpdate: sdk.A2A.TaskStatusUpdateEvent =
      sdk.describe.update.completed({
        taskId: task.id,
        contextId: task.contextId,
        message: sdk.describe.message({
          messageId: uuidv4(),
          role: "agent",
          parts: [sdk.describe.part.text(result.text)],
          metadata,
        }),
      });
    yield completedUpdate;
  });
};
