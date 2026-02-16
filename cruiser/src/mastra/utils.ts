/**
 * @fileoverview mastra → artinet utils
 *
 * @module @artinet/cruiser/mastra/utils
 * @internal
 * @description
 * Internal utilities for the Mastra adapter. Handles conversion between
 * Mastra message types and artinet types.
 *
 * @see {@link https://github.com/mastra-ai/mastra} Mastra Source
 */

import * as sdk from '@artinet/sdk';
import { AgentExecutionOptions, Agent as MastraAgent } from '@mastra/core/agent';
import { CoreMessage, SystemMessage } from '@mastra/core/llm';
import { OutputSchema } from '@mastra/core/stream';

/**
 * Converts Mastra {@link SystemMessage} instructions to a plain string.
 *
 * Handles various instruction formats:
 * - Simple strings pass through directly
 * - Arrays of strings/objects are joined with newlines
 * - Single message objects have content extracted
 *
 * @param message - The {@link SystemMessage} in various Mastra formats
 * @returns The instructions as a single string
 *
 * @see {@link https://github.com/mastra-ai/mastra/blob/main/packages/server/src/server/utils.ts#L154-L178}
 *
 * @internal
 */
function convertInstructionsToString(message: SystemMessage): string {
    if (!message) {
        return '';
    }

    if (typeof message === 'string') {
        return message;
    }

    if (Array.isArray(message)) {
        return message
            .map((m) => {
                if (typeof m === 'string') {
                    return m;
                }
                // Safely extract content from message objects
                return typeof m.content === 'string' ? m.content : '';
            })
            .filter((content) => content) // Remove empty strings
            .join('\n');
    }

    // Handle single message object - safely extract content
    return typeof message.content === 'string' ? message.content : '';
}

/**
 * Builds an {@link sdk.A2A.AgentCard} from Mastra agent configuration.
 *
 * Creates a standardized AgentCard by extracting the agent's identity,
 * instructions, and tools. Converts Mastra tools to {@link sdk.A2A.AgentSkill} definitions.
 *
 * @param params - Configuration parameters
 * @param params.agent - The {@link MastraAgent} to extract metadata from
 * @param params.card - Optional {@link sdk.A2A.AgentCardParams} card overrides
 * @param params.options - Optional {@link AgentExecutionOptions} (currently unused for card generation)
 *
 * @returns A Promise resolving to a fully populated {@link sdk.A2A.AgentCard}
 *
 * @see {@link https://github.com/mastra-ai/mastra/blob/main/packages/server/src/server/handlers/a2a.ts#L46}
 *
 * @example
 * ```typescript
 * const card = await getAgentCard({
 *   agent: myMastraAgent,
 *   card: { name: "Custom Name" },
 * });
 * ```
 */
export async function getAgentCard<OUTPUT extends OutputSchema = undefined>({
    agent,
    card,
    options: _options,
}: {
    agent: MastraAgent;
    card?: sdk.A2A.AgentCardParams;
    options?: AgentExecutionOptions<OUTPUT>;
}): Promise<sdk.A2A.AgentCard> {
    const [instructions, tools = {}]: [
        Awaited<ReturnType<typeof agent.getInstructions>>,
        Awaited<ReturnType<typeof agent.listTools>> | undefined,
    ] = await Promise.all([agent.getInstructions(), agent.listTools?.() ?? Promise.resolve({})]);

    const agentCard: sdk.A2A.AgentCard = sdk.describe.card({
        name: agent.id,
        ...(typeof card === 'string' ? { name: card } : card),
        description: convertInstructionsToString(instructions),
        capabilities: {
            streaming: true,
            pushNotifications: true,
            stateTransitionHistory: false,
        },
        defaultInputModes: ['text'],
        defaultOutputModes: ['text'],
        skills: Object.entries(tools).map(([toolId, tool]) => ({
            id: toolId,
            name: toolId,
            description: tool.description || `Tool: ${toolId}`,
            tags: ['tool'],
        })),
    });

    return agentCard;
}

/**
 * Converts an {@link sdk.A2A.Message} to Mastra's {@link CoreMessage} format.
 *
 * Maps {@link sdk.A2A.Message} roles and parts to the format expected by Mastra's
 * `agent.generate()` method.
 *
 * @param message - The {@link sdk.A2A.Message} to convert
 * @returns A Mastra {@link CoreMessage} ready for `agent.generate()`
 *
 * @see {@link https://github.com/mastra-ai/mastra/blob/main/packages/server/src/server/a2a/protocol.ts#L59}
 *
 * @example
 * ```typescript
 * const a2aMessages = sdk.getLatestHistory(task);
 * const coreMessages = a2aMessages.map(convertToCoreMessage);
 * const result = await agent.generate(coreMessages);
 * ```
 */
export function convertToCoreMessage(message: sdk.A2A.Message): CoreMessage {
    return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.parts.map((msg) => convertToCoreMessagePart(msg)),
    };
}

/**
 * Converts an {@link sdk.A2A.Part} to a Mastra CoreMessage content part.
 *
 * Handles {@link sdk.A2A.TextPart | text}, {@link sdk.A2A.FilePart | file},
 * and {@link sdk.A2A.DataPart | data} parts with appropriate type mappings.
 *
 * @param part - The {@link sdk.A2A.Part} to convert
 * @returns A Mastra-compatible content part
 *
 * @throws Error if a {@link sdk.A2A.DataPart | data part} is encountered (not supported in core messages)
 *
 * @internal
 */
function convertToCoreMessagePart(part: sdk.A2A.Part) {
    switch (part.kind) {
        case 'text':
            return {
                type: 'text',
                text: part.text,
            } as const;
        case 'file':
            return {
                type: 'file',
                data:
                    'uri' in part.file && part.file.uri
                        ? new URL(part.file.uri)
                        : /**Appeasing the type system */
                          part.file.bytes!,
                mimeType: part.file.mimeType ?? 'unknown',
            } as const;
        case 'data':
            throw new Error('Data parts are not supported in core messages');
    }
}
