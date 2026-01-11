/**
 * @fileoverview strands → artinet utils
 *
 * @module @artinet/cruiser/strands/utils
 * @internal
 * @description
 * Internal utilities for the Strands adapter. Handles conversion between
 * Strands Agents SDK types and artinet types.
 */

import * as sdk from "@artinet/sdk";
import {
  Agent as StrandsAgent,
  Tool,
  Message,
  TextBlock,
  SystemContentBlock,
} from "@strands-agents/sdk";
import { v4 as uuidv4 } from "uuid";

/**
 * Extracts text content from a Strands {@link SystemContentBlock}.
 *
 * Handles various block types:
 * - Plain strings pass through directly
 * - {@link TextBlock}: extracts the text property
 * - GuardContentBlock: extracts nested text
 *
 * @param block - The {@link SystemContentBlock} to extract text from
 * @returns The extracted text content, or empty string if not extractable
 *
 * @internal
 */
function extractTextBlock(block: SystemContentBlock): string {
  if (typeof block === "string") {
    return block;
  }

  if (block.type === "textBlock") {
    return block.text;
  }

  if (block.type === "guardContentBlock") {
    return block.text?.text ?? "";
  }

  return "";
}

/**
 * Creates a description string from a {@link StrandsAgent}'s system prompt.
 *
 * Handles various system prompt formats:
 * - String: returns directly
 * - Array: joins all text blocks with newlines
 *
 * @param agent - The {@link StrandsAgent} to extract description from
 * @returns The extracted description string
 *
 * @internal
 */
function createDescription(agent: StrandsAgent): string {
  let description = "A Strands Agent that can perform tasks";

  if (typeof agent.systemPrompt === "string") {
    /**We don't want to reveal the entire system prompt.
     * Just a few words to give the caller a hint about the agent's capabilities*/
    description = agent.systemPrompt.trim().slice(0, 128);
  }

  if (Array.isArray(agent.systemPrompt)) {
    /**We don't want to reveal the entire system prompt.
     * Just a few words to give the caller a hint about the agent's capabilities*/
    description = agent.systemPrompt
      .map(extractTextBlock)
      .join("\n")
      .trim()
      .slice(0, 128);
  }

  return description;
}

/**
 * Converts Strands {@link Tool} array to {@link sdk.A2A.AgentSkill} definitions.
 *
 * @param tools - Array of Strands {@link Tool} instances to convert
 * @returns Array of {@link sdk.A2A.AgentSkill} definitions
 *
 * @internal
 */
function createSkills(tools: Tool[]): sdk.A2A.AgentSkill[] {
  return tools.map((tool) => ({
    id: tool.name,
    name: tool.name,
    description: tool.description || `Tool: ${tool.name}`,
    tags: ["tool"],
  }));
}

/**
 * Builds an {@link sdk.A2A.AgentCard} from {@link StrandsAgent} configuration.
 *
 * Creates a standardized AgentCard that describes the Strands agent's
 * identity, capabilities, and skills.
 *
 * @param params - Configuration parameters
 * @param params.agent - The {@link StrandsAgent} to extract metadata from
 * @param params.card - Optional {@link sdk.A2A.AgentCardParams} card overrides
 *
 * @returns A Promise resolving to a fully populated {@link sdk.A2A.AgentCard}
 *
 * @example
 * ```typescript
 * const card = await getAgentCard({
 *   agent: myStrandsAgent,
 *   card: { name: "Custom Bot" },
 * });
 * ```
 */
export async function getAgentCard({
  agent,
  card,
}: {
  agent: StrandsAgent;
  card?: sdk.A2A.AgentCardParams;
}): Promise<sdk.A2A.AgentCard> {
  const name = "strands-agent-" + uuidv4().slice(0, 8);
  const description = createDescription(agent);

  const agentCard: sdk.A2A.AgentCard = sdk.describe.card({
    name,
    ...(typeof card === "string" ? { name: card } : card),
    description,
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: createSkills(agent.tools),
  });

  return agentCard;
}

/**
 * Converts an {@link sdk.A2A.Message} to a Strands {@link Message} format.
 *
 * Creates a Strands {@link Message} instance with the appropriate role and
 * text content extracted from {@link sdk.A2A.Part} array.
 *
 * @param message - The {@link sdk.A2A.Message} to convert
 * @returns A Strands {@link Message} ready for `agent.messages`
 *
 * @example
 * ```typescript
 * const a2aMessages = sdk.getLatestHistory(task);
 * const strandsMessages = a2aMessages.map(createStrandsMessage);
 * strandsMessages.forEach(msg => agent.messages.push(msg));
 * ```
 */
export function createStrandsMessage(message: sdk.A2A.Message): Message {
  const role = message.role === "user" ? "user" : "assistant";

  const textContent = sdk.extractTextContent(message, false);
  if (!textContent) {
    return new Message({
      role,
      content: [],
    });
  }

  return new Message({
    role,
    content: [new TextBlock(textContent)],
  });
}
