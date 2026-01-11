/**
 * @fileoverview strands → artinet
 *
 * @module @artinet/cruiser/strands
 * @description
 * This adapter "parks" {@link StrandsAgent | Strands Agents} (from `@strands-agents/sdk`) into the
 * artinet, enabling them to participate in multi-agent workflows.
 * Strands is AWS's open-source agent framework with native Bedrock integration.
 *
 * ## Design Decisions
 *
 * 1. **Message Management**: Strands agents maintain internal message history
 *    via `agent.messages`. We push converted history messages before invocation.
 *
 * 2. **Simple Invocation**: Uses `agent.invoke(text)` for execution, which
 *    accepts only string input unlike other frameworks that take message objects.
 *
 * 3. **Result Extraction**: Strands returns an {@link AgentResult} that converts to
 *    string via `.toString()` method for text response extraction.
 *
 * 4. **AWS Bedrock**: Strands agents typically use AWS Bedrock models, making
 *    this adapter ideal for AWS-native deployments.
 *
 * ## Usage
 *
 * ```typescript
 * import { Agent } from "@strands-agents/sdk";
 * import { park } from "@artinet/cruiser/strands";
 * import { serve } from "@artinet/sdk";
 *
 * const strandsAgent = new Agent({
 *   model: "anthropic.claude-3-sonnet",
 *   systemPrompt: "You are a helpful assistant",
 * });
 *
 * const artinetAgent = await park(strandsAgent, { name: "Strands Bot" });
 * serve({agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://strandsagents.com/docs} Strands Agents Documentation
 */

import {
  Agent as StrandsAgent,
  AgentResult,
  Message as StrandsMessage,
} from "@strands-agents/sdk";
import * as sdk from "@artinet/sdk";
import { Park } from "../corsair.js";
import { getAgentCard, createStrandsMessage } from "./utils.js";

/**
 * Parks a {@link StrandsAgent} into artinet.
 *
 * Transforms a Strands Agent instance into an {@link sdk.Agent | A2A-compatible agent}
 * that can be deployed on artinet.
 *
 * @param agent - The {@link StrandsAgent} to park
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize identity and capabilities
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example Basic Usage
 * ```typescript
 * import { park } from "@artinet/cruiser/strands";
 * import { Agent } from "@strands-agents/sdk";
 *
 * const agent = new Agent({
 *   model: "anthropic.claude-3-haiku",
 *   systemPrompt: "Be helpful and concise",
 * });
 *
 * const artinetAgent = await park(agent, { name: "Quick Helper" });
 * ```
 *
 * @example With Custom Tools
 * ```typescript
 * import { park } from "@artinet/cruiser/strands";
 * import { Agent, tool } from "@strands-agents/sdk";
 *
 * const agent = new Agent({
 *   model: "anthropic.claude-3-sonnet",
 *   systemPrompt: "Help users with calculations",
 *   tools: [calculatorTool, converterTool],
 * });
 *
 * const artinetAgent = await park(agent, {
 *   name: "Math Helper",
 *   description: "Calculator and unit conversion assistant",
 * });
 * ```
 *
 * @example With AWS Bedrock Configuration
 * ```typescript
 * import { park } from "@artinet/cruiser/strands";
 * import { Agent } from "@strands-agents/sdk";
 *
 * const agent = new Agent({
 *   model: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
 *   systemPrompt: "You are an enterprise assistant",
 *   region: "us-west-2",
 * });
 *
 * const artinetAgent = await park(agent, { name: "Enterprise Bot" });
 * ```
 */
export const park: Park<StrandsAgent, never> = async (
  agent: StrandsAgent,
  card?: sdk.A2A.AgentCardParams
): Promise<sdk.Agent> => {
  const agentCard = await getAgentCard({ agent, card });

  sdk.logger.debug(
    `Strands[${agentCard.name}]:[card:${JSON.stringify(agentCard)}]`
  );

  return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
    sdk.logger.debug(
      `Strands[${agentCard.name}]:[context:${context.contextId}]: starting`
    );

    const task: sdk.A2A.Task = await context.getTask();

    const history: sdk.A2A.Message[] = sdk.getLatestHistory(task);

    const strandsMessages: StrandsMessage[] = history.map(createStrandsMessage);

    for (const msg of strandsMessages) {
      agent.messages.push(msg);
    }

    const inputText = sdk.extractTextContent(context.userMessage);
    if (!inputText) {
      yield sdk.describe.update.failed({
        taskId: task.id,
        contextId: task.contextId,
        message: sdk.describe.message({
          role: "agent",
          parts: [sdk.describe.part.text("no input text detected")],
        }),
      });
      return;
    }

    const result: AgentResult = await agent.invoke(inputText);

    const response: string = result.toString();

    const metadata = {
      ...(task.metadata ?? {}),
      result: {
        stopReason: result.stopReason,
      },
    };

    const completedUpdate: sdk.A2A.TaskStatusUpdateEvent =
      sdk.describe.update.completed({
        taskId: task.id,
        contextId: task.contextId,
        message: sdk.describe.message({
          role: "agent",
          parts: [sdk.describe.part.text(response)],
          metadata,
        }),
      });

    yield completedUpdate;
  });
};
