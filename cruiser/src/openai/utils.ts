/**
 * @fileoverview openai → artinet utils
 *
 * @module @artinet/cruiser/openai/utils
 * @internal
 * @description
 * Internal utilities for the OpenAI adapter. Handles conversion between
 * OpenAI Agents SDK types and artinet types.
 */

import * as sdk from "@artinet/sdk";
import {
  Agent as OpenAIAgent,
  FunctionTool,
  RunResult,
  AgentInputItem,
  extractAllTextOutput,
} from "@openai/agents";

/**
 * Converts {@link OpenAIAgent} tools to {@link sdk.A2A.AgentSkill} definitions.
 *
 * Extracts name and description from each tool to create artinet-compatible
 * skill entries for the agent card.
 *
 * @param agent - The {@link OpenAIAgent} with tools to convert
 * @returns A Promise resolving to an array of {@link sdk.A2A.AgentSkill} definitions
 *
 * @internal
 */
async function convertToolsToSkills(
  agent: OpenAIAgent
): Promise<sdk.A2A.AgentSkill[]> {
  return (
    agent.tools.map((tool) => ({
      id: tool.name,
      name: tool.name,
      description:
        (tool as FunctionTool<unknown, any>)?.description ||
        `A tool that can be used to ${tool.name}`,
      tags: ["tool"],
    })) ?? []
  );
}

/**
 * Builds an {@link sdk.A2A.AgentCard} from {@link OpenAIAgent} configuration.
 *
 * Creates a standardized AgentCard that describes the OpenAI agent's
 * identity, capabilities, and skills in the artinet format.
 *
 * @param params - Configuration parameters
 * @param params.agent - The {@link OpenAIAgent} to extract metadata from
 * @param params.card - Optional {@link sdk.A2A.AgentCardParams} card overrides
 *
 * @returns A Promise resolving to a fully populated {@link sdk.A2A.AgentCard}
 *
 * @example
 * ```typescript
 * const card = await getAgentCard({
 *   agent: myOpenAIAgent,
 *   card: { name: "Custom Name", description: "Custom description" },
 * });
 * ```
 */
export async function getAgentCard({
  agent,
  card,
}: {
  agent: OpenAIAgent;
  card?: sdk.A2A.AgentCardParams;
}): Promise<sdk.A2A.AgentCard> {
  const agentCard: sdk.A2A.AgentCard = sdk.describe.card({
    name: agent.name,
    ...(typeof card === "string" ? { name: card } : card),
    description: agent.handoffDescription,
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: await convertToolsToSkills(agent),
  });

  return agentCard;
}

/**
 * Converts an {@link sdk.A2A.Message} to OpenAI's {@link AgentInputItem} format.
 *
 * Maps {@link sdk.A2A.Part} to OpenAI's content format, handling
 * {@link sdk.A2A.TextPart | text} and {@link sdk.A2A.FilePart | file} parts
 * appropriately for each message role.
 *
 * @param message - The {@link sdk.A2A.Message} to convert
 * @returns An {@link AgentInputItem} ready for the {@link run} function
 *
 * @example
 * ```typescript
 * const a2aMessages = sdk.getLatestHistory(task);
 * const inputItems = a2aMessages.map(convertToAgentInputItem);
 * const result = await run(agent, inputItems);
 * ```
 */
export function convertToAgentInputItem(
  message: sdk.A2A.Message
): AgentInputItem {
  const isUserMessage = message.role === "user";

  const content =
    message.parts.map((part) => {
      if (part.kind === "text") {
        return {
          type: "input_text" as const,
          text: part.text,
        };
      }
      if (part.kind === "file") {
        return {
          type: "input_file" as const,
          file: part.file.uri ?? part.file.bytes,
        };
      }
      return {
        type: "input_text" as const,
        text: JSON.stringify(part.data),
      };
    }) ?? [];

  if (isUserMessage) {
    return {
      type: "message",
      role: "user",
      content,
    };
  }

  return {
    type: "message",
    role: "assistant",
    status: "completed",
    content: content
      /**filter all the files out */
      .filter((item) => item.text !== undefined)
      .map((item) => ({
        type: "output_text",
        text: item.text,
      })),
  };
}

/**
 * Converts an OpenAI {@link RunResult} to an {@link sdk.A2A.Message}.
 *
 * Extracts the `finalOutput` from the run result, handling both string
 * and structured outputs appropriately.
 *
 * @param taskId - The task identifier
 * @param contextId - The context identifier
 * @param result - The {@link RunResult} containing finalOutput
 *
 * @returns An {@link sdk.A2A.Message} containing the response
 *
 * @example
 * ```typescript
 * const result = await run(agent, input);
 * const a2aMessage = extractA2AMessage(
 *   "task-123",
 *   "ctx-456",
 *   result
 * );
 * ```
 */
export function extractA2AMessage(
  taskId: string,
  contextId: string,
  result: RunResult<unknown, any>
): sdk.A2A.Message {
  if (!result.finalOutput) {
    /**Do we want to throw here? or just log a warning?*/
    sdk.logger.warn(
      `No final output from OpenAI agent: ${JSON.stringify(result)}`
    );
    let text: string = "";

    if (result.newItems && result.newItems.length > 0) {
      text = extractAllTextOutput(result.newItems) as string;
    }

    return sdk.describe.message({
      taskId,
      contextId,
      parts: [sdk.describe.part.text(text)],
    });
  }
  let parts: sdk.A2A.Part[] = [];

  if (typeof result.finalOutput === "string") {
    parts.push(sdk.describe.part.text(result.finalOutput));
  } else {
    parts.push(sdk.describe.part.data({ ...result.finalOutput }));
  }

  return sdk.describe.message({ taskId, contextId, parts });
}
