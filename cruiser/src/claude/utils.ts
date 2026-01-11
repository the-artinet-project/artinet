/**
 * @fileoverview claude → artinet utils
 *
 * @module @artinet/cruiser/claude/utils
 * @internal
 * @description
 * Internal utilities for the Claude adapter. Handles conversion between
 * Claude Agent SDK types and artinet types.
 */

import * as sdk from "@artinet/sdk";
import type {
  Options,
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { v4 as uuidv4 } from "uuid";

/**
 * Claude Agent configuration type.
 * Represents the {@link Options} used to configure a Claude Agent instance.
 * @see {@link Options} from `@anthropic-ai/claude-agent-sdk`
 */
export type ClaudeAgent = Options;

/**
 * Generates a unique agent name for Claude agents.
 *
 * @param _agent - Optional {@link ClaudeAgent} configuration (currently unused)
 * @returns A unique agent name with format "claude-agent-{uuid}"
 *
 * @internal
 */
function createAgentName(_agent?: ClaudeAgent): string {
  return "claude-agent" + uuidv4().slice(0, 8);
}

/**
 * Extracts or creates a description for the agent from its system prompt.
 *
 * @param agent - Optional {@link ClaudeAgent} configuration
 * @returns The system prompt as description, or a default description
 *
 * @internal
 */
function createAgentDescription(agent?: ClaudeAgent): string {
  if (!agent || !agent.systemPrompt || typeof agent.systemPrompt !== "string") {
    return "A Claude Agent that can perform coding tasks";
  }
  return agent.systemPrompt;
}

/**
 * Converts Claude Agent tools to {@link sdk.A2A.AgentSkill} definitions.
 *
 * @param agent - Optional {@link ClaudeAgent} configuration
 * @returns Array of {@link sdk.A2A.AgentSkill} definitions derived from agent tools
 *
 * @internal
 */
function createAgentSkills(agent?: ClaudeAgent): sdk.A2A.AgentSkill[] {
  if (!agent || !agent.tools || !Array.isArray(agent.tools)) {
    return [
      {
        id: "code-execution",
        name: "Code Execution",
        description: "Execute and modify code files",
        tags: ["coding", "files"],
      },
    ];
  }

  const tools: string[] = agent.tools ?? agent.allowedTools ?? [];
  return tools.map((tool: string) => ({
    id: tool + "-" + uuidv4().slice(0, 8),
    name: tool,
    description: `A tool that can be used to ${tool}`,
    tags: ["tool"],
  }));
}

/**
 * Builds an {@link sdk.A2A.AgentCard} from Claude agent configuration.
 *
 * Creates a standardized AgentCard that describes the Claude agent's
 * identity, capabilities, and skills.
 *
 * @param params - Configuration parameters
 * @param params.agent - Optional {@link ClaudeAgent} configuration
 * @param params.card - Optional {@link sdk.A2A.AgentCardParams} card overrides
 *
 * @returns A Promise resolving to a fully populated {@link sdk.A2A.AgentCard}
 *
 * @example
 * ```typescript
 * const card = await getAgentCard({
 *   agent: { systemPrompt: "You are a coder" },
 *   card: { name: "My Coder" },
 * });
 * ```
 */
export async function getAgentCard({
  agent,
  card,
}: {
  agent?: ClaudeAgent;
  card?: sdk.A2A.AgentCardParams;
}): Promise<sdk.A2A.AgentCard> {
  const name = createAgentName(agent);
  const description = createAgentDescription(agent);

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
    skills: createAgentSkills(agent),
  });

  return agentCard;
}

/**
 * Converts Claude SDK content blocks to {@link sdk.A2A.Part} array.
 *
 * @param content - Claude SDK message content (string or block array)
 * @returns Array of {@link sdk.A2A.Part} message parts
 *
 * @internal
 */
function convertContentBlocks(
  content:
    | SDKUserMessage["message"]["content"]
    | SDKAssistantMessage["message"]["content"]
): sdk.A2A.Part[] {
  if (typeof content === "string") {
    return [sdk.describe.part.text(content)];
  }
  return content.map((block) => {
    if (block.type === "text") return sdk.describe.part.text(block.text);
    if (block.type === "thinking")
      return sdk.describe.part.text(block.thinking);
    return sdk.describe.part.data({ ...block });
  });
}

/**
 * Converts a Claude {@link SDKMessage} to an {@link sdk.A2A.Message}.
 *
 * Transforms the Claude-specific message format into the standardized
 * {@link sdk.A2A.Message} format for cross-framework compatibility.
 *
 * @param taskId - The task identifier
 * @param contextId - The context identifier
 * @param message - The {@link SDKMessage} to convert
 *
 * @returns An {@link sdk.A2A.Message} formatted message
 *
 * @example
 * ```typescript
 * const a2aMessage = extractA2AMessage(
 *   "task-123",
 *   "ctx-456",
 *   claudeSDKMessage
 * );
 * ```
 */
export function extractA2AMessage(
  taskId: string,
  contextId: string,
  message: SDKMessage
): sdk.A2A.Message {
  const role = message.type === "user" ? "user" : "agent";
  let parts: sdk.A2A.Part[] = [];

  if (message.type === "user" || message.type === "assistant") {
    parts = convertContentBlocks(message.message.content);
  } else {
    parts = [sdk.describe.part.data({ ...message })];
  }

  return sdk.describe.message({
    taskId,
    contextId,
    role,
    parts,
    metadata: {
      ...message,
    },
  });
}
