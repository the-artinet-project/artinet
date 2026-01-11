/**
 * @fileoverview langchain → artinet utils
 *
 * @module @artinet/cruiser/langchain/utils
 * @internal
 * @description
 * Internal utilities for the LangChain adapter. Handles conversion between
 * LangChain message types and artinet types.
 */

import * as sdk from "@artinet/sdk";
import { ReactAgent } from "langchain";
import type { ServerTool, ClientTool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  ContentBlock,
} from "@langchain/core/messages";
import { isRunnableToolLike } from "@langchain/core/tools";
import { v4 as uuidv4 } from "uuid";

/**
 * Extracts the agent name from a {@link ReactAgent}.
 *
 * @param agent - The {@link ReactAgent} to extract name from
 * @returns The agent name from options, or a generated unique name
 *
 * @internal
 */
function extractAgentName(agent: ReactAgent): string {
  return (
    agent.options.name ||
    "langchain-agent-" + agent.options.model.toString() + uuidv4().slice(0, 8)
  );
}

/**
 * Converts LangChain agent tools to {@link sdk.A2A.AgentSkill} definitions.
 *
 * Extracts name and description from each tool, handling both
 * {@link ServerTool}, {@link ClientTool}, and RunnableToolLike instances.
 *
 * @param agent - The {@link ReactAgent} with tools to convert
 * @returns Array of {@link sdk.A2A.AgentSkill} definitions
 *
 * @internal
 */
function createSkills(agent: ReactAgent): sdk.A2A.AgentSkill[] {
  return (
    agent.options.tools?.map((tool: ServerTool | ClientTool) => {
      let name: string = "";
      let description: string = "";
      if ("name" in tool && typeof tool.name === "string") {
        name = tool.name;
      } else if (isRunnableToolLike(tool)) {
        name = tool.getName();
      }
      if ("description" in tool && typeof tool.description === "string") {
        description = tool.description;
      }
      return {
        id: name + "-" + uuidv4().slice(0, 8),
        name,
        description,
        tags: ["tool"],
      };
    }) ?? []
  );
}

/**
 * Builds an {@link sdk.A2A.AgentCard} from LangChain agent configuration.
 *
 * Creates a standardized AgentCard that describes the LangChain agent's
 * identity, capabilities, and skills.
 *
 * @param params - Configuration parameters
 * @param params.agent - The {@link ReactAgent} to extract metadata from
 * @param params.card - Optional {@link sdk.A2A.AgentCardParams} card overrides
 *
 * @returns A Promise resolving to a fully populated {@link sdk.A2A.AgentCard}
 *
 * @example
 * ```typescript
 * const card = await getAgentCard({
 *   agent: myLangChainAgent,
 *   card: { name: "Research Bot" },
 * });
 * ```
 */
export async function getAgentCard({
  agent,
  card,
}: {
  agent: ReactAgent;
  card?: sdk.A2A.AgentCardParams;
}): Promise<sdk.A2A.AgentCard> {
  const name = extractAgentName(agent);
  const skills = createSkills(agent);

  const agentCard: sdk.A2A.AgentCard = sdk.describe.card({
    name,
    ...(typeof card === "string" ? { name: card } : card),
    description: agent.options.model.toString() ?? "",
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills,
  });

  return agentCard;
}

/**
 * Converts an {@link sdk.A2A.Message} to a LangChain message type.
 *
 * Maps {@link sdk.A2A.Part} to LangChain {@link ContentBlock} format and creates
 * the appropriate message class ({@link HumanMessage} or {@link AIMessage}) based on role.
 *
 * @param message - The {@link sdk.A2A.Message} to convert
 * @returns A LangChain {@link HumanMessage} or {@link AIMessage} instance
 *
 * @example
 * ```typescript
 * const a2aMessage: sdk.A2A.Message = { role: "user", parts: [...] };
 * const langchainMessage = convertToLangChainMessage(a2aMessage);
 * // Returns: {@link HumanMessage} or {@link AIMessage} instance
 * ```
 */
export function convertToLangChainMessage(
  message: sdk.A2A.Message
): HumanMessage | AIMessage {
  const blocks: ContentBlock[] = message.parts.map((part) => {
    if (part.kind === "text") {
      return {
        type: "text",
        text: part.text,
      };
    }
    if (part.kind === "file") {
      return {
        type: "file",
        data: part.file,
        mimeType: part.file.mimeType,
      };
    }
    return {
      type: "non_standard",
      value: part.data,
    };
  });

  if (message.role === "user") {
    return new HumanMessage(blocks);
  }
  return new AIMessage(blocks);
}

/**
 * Type helper for extracting the result type from a {@link ReactAgent} invocation.
 * @internal
 */
type AgentResult<TAgent extends ReactAgent<any>> = Awaited<
  ReturnType<TAgent["invoke"]>
>;

/**
 * Converts a LangChain agent result to an {@link sdk.A2A.Message}.
 *
 * Handles various result formats:
 * - String results: Converted to {@link sdk.A2A.TextPart | text parts}
 * - Structured responses: Converted to {@link sdk.A2A.DataPart | data parts}
 * - Message arrays: Each message content is extracted
 *
 * @param taskId - The task identifier
 * @param contextId - The context identifier
 * @param result - The LangChain agent execution result
 * @param _agent - The {@link ReactAgent} instance (for type inference)
 *
 * @returns An {@link sdk.A2A.Message} containing the response
 *
 * @example
 * ```typescript
 * const result = await agent.invoke({ messages });
 * const a2aMessage = extractA2AMessage(
 *   "task-123",
 *   "ctx-456",
 *   result,
 *   agent
 * );
 * ```
 */
export function extractA2AMessage<TAgent extends ReactAgent>(
  taskId: string,
  contextId: string,
  result: AgentResult<TAgent>,
  _agent: TAgent
): sdk.A2A.Message {
  if (!result) {
    return sdk.describe.message({
      taskId,
      contextId,
      parts: [sdk.describe.part.text("")],
    });
  }

  let parts: sdk.A2A.Part[] = [];

  if (typeof result === "string") {
    parts.push(sdk.describe.part.text(result));
  } else if (result.structuredResponse) {
    parts.push(sdk.describe.part.data({ ...result.structuredResponse }));
  } else if (result.messages) {
    for (const message of result.messages) {
      if (typeof message.content === "string") {
        parts.push(sdk.describe.part.text(message.content));
      } else {
        /**Pop the last block which belongs to the assistant */
        const block = message.content.pop();
        if (block && block.type === "text") {
          parts.push(sdk.describe.part.text(block.text as string));
        } else if (block) {
          parts.push(sdk.describe.part.data({ ...block }));
        }
      }
    }
  }
  return sdk.describe.message({
    taskId,
    contextId,
    parts,
  });
}
