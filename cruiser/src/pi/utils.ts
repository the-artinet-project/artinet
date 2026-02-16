/**
 * @fileoverview pi-agent-core → artinet utils
 *
 * @module @artinet/cruiser/pi-agent-core/utils
 * @internal
 * @description
 * Internal conversion and normalization utilities used by the pi-agent-core dock.
 *
 * These helpers are intentionally conservative:
 * - They preserve predictable A2A text-first behavior.
 * - They avoid leaking full internal prompts in public card descriptions.
 * - They tolerate loosely structured message content emitted by LLM frameworks.
 */

import * as sdk from '@artinet/sdk';
import type { Agent as PiAgent, AgentMessage as PiMessage, AgentTool as PiTool } from '@mariozechner/pi-agent-core';
import type { AssistantMessage, ThinkingContent, TextContent, Usage } from '@mariozechner/pi-ai';
import { v4 as uuidv4 } from 'uuid';

const MAX_DESCRIPTION_LENGTH = 128;

/**
 * Creates a safe, human-readable card description from the agent's system prompt.
 *
 * The output is intentionally truncated to avoid leaking large/private prompt details
 * through public-facing agent metadata.
 */
function createDescription(agent: PiAgent): string {
    const systemPrompt: string = agent.state.systemPrompt?.trim();
    if (!systemPrompt) {
        return 'A pi-agent-core Agent';
    }
    return systemPrompt.slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Converts pi-agent-core tool definitions into A2A agent skills.
 *
 * @param tools - Tools configured in `agent.state.tools`.
 * @returns A2A-compatible skill descriptors used in agent cards.
 */
function createSkills(tools: PiTool[]): sdk.A2A.AgentSkill[] {
    return tools.map((tool) => ({
        id: tool.name,
        name: tool.label || tool.name,
        description: tool.description || `A tool that can be used to ${tool.name}`,
        tags: ['tool'],
    }));
}
/**
 * Creates a metadata object for a Pi agent.
 *
 * @param agent - The Pi agent to create metadata for.
 * @returns A metadata object.
 */
export function createMetadata(agent: PiAgent): Record<string, unknown> {
    return {
        model: agent.state.model.id,
        provider: agent.state.model.provider,
        api: agent.state.model.api,
        cost: agent.state.model.cost,
    };
}
/**
 * Builds an A2A AgentCard for a pi-agent.
 *
 * @param params.agent - Source pi-agent.
 * @param params.card - Optional caller-provided card overrides.
 * @returns Fully populated A2A AgentCard instance.
 */
export async function getAgentCard({
    agent,
    card,
}: {
    agent: PiAgent;
    card?: sdk.A2A.AgentCardParams;
}): Promise<sdk.A2A.AgentCard> {
    return sdk.describe.card({
        name: `pi-agent-${agent.state.model.id}-${uuidv4().slice(0, 8)}`,
        ...(typeof card === 'string' ? { name: card } : card),
        description: createDescription(agent),
        capabilities: {
            streaming: true,
            pushNotifications: true,
            stateTransitionHistory: false,
        },
        defaultInputModes: ['text'],
        defaultOutputModes: ['text'],
        skills: createSkills(agent.state.tools),
    });
}

/**
 * Converts an A2A message into a minimal pi-agent-core message shape.
 *
 * Conversion strategy:
 * - A2A `user` maps to pi-agent-core `user`
 * - All non-user roles map to a valid pi-agent-core `assistant` message
 * - Assistant messages are rebuilt with required metadata/usage defaults
 *
 * @param message - Source A2A message.
 * @param timestamp - Optional explicit timestamp for deterministic tests.
 * @returns pi-agent-core compatible `AgentMessage`.
 */
export function convertToPiMessage(message: sdk.A2A.Message, timestamp = Date.now()): PiMessage {
    if (message.role === 'user') {
        const text = sdk.extractTextContent(message, false);
        return {
            role: 'user',
            content: text ?? '',
            timestamp,
        } as PiMessage;
    }

    const assistantText = sdk.extractTextContent(message, false);
    const modelName = typeof message.metadata?.model === 'string' ? message.metadata.model : 'unknown';
    const provider = typeof message.metadata?.provider === 'string' ? message.metadata.provider : 'unknown';
    const api = typeof message.metadata?.api === 'string' ? message.metadata.api : 'openai-responses';
    const cost =
        typeof message.metadata?.cost === 'object' && message.metadata.cost !== null
            ? (message.metadata.cost as Usage['cost'])
            : {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 0,
              };

    const usage: Usage = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost,
    };

    const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content: assistantText ? [{ type: 'text', text: assistantText }] : [],
        api,
        provider,
        model: modelName,
        usage,
        stopReason: 'stop',
        timestamp,
    };

    return assistantMessage as PiMessage;
}

const isTextContent = (content: unknown): content is TextContent => {
    return (
        typeof content === 'object' &&
        content !== null &&
        'type' in content &&
        content.type === 'text' &&
        'text' in content &&
        typeof content.text === 'string'
    );
};

const isThinkingContent = (content: unknown): content is ThinkingContent => {
    return (
        typeof content === 'object' &&
        content !== null &&
        'type' in content &&
        content.type === 'thinking' &&
        'thinking' in content &&
        typeof content.thinking === 'string'
    );
};

/**
 * Best-effort extraction of displayable text from a pi-agent-core message.
 *
 * Supports common content variants:
 * - `string`
 * - content arrays with text fragments/parts
 * - object payloads carrying a `text` field
 *
 * Returns empty string when no text can be extracted.
 */
export function extractA2AMessage(
    message: PiMessage,
    taskId: string,
    contextId: string,
    metadata: Record<string, unknown>,
): sdk.A2A.Message {
    if (typeof message !== 'object' || message === null) {
        return sdk.describe.message({
            taskId,
            contextId,
            parts: [sdk.describe.part.text('No content found')],
            metadata,
        });
    }

    const content: unknown = (message as { content?: unknown })?.content;

    if (typeof content === 'string') {
        return sdk.describe.message({
            taskId,
            contextId,
            parts: [sdk.describe.part.text(content)],
            metadata,
        });
    }

    if (Array.isArray(content)) {
        const parts: sdk.A2A.Part[] = content
            .map((part) => {
                if (typeof part === 'string') {
                    return sdk.describe.part.text(part);
                }
                if (isTextContent(part)) {
                    return sdk.describe.part.text(part.text);
                } else if (isThinkingContent(part)) {
                    return sdk.describe.part.text(part.thinking);
                }
                return sdk.describe.part.data({ ...part });
            })
            .filter(Boolean);
        return sdk.describe.message({
            taskId,
            contextId,
            parts,
            metadata,
        });
    }

    if (typeof content === 'object' && content !== null) {
        return sdk.describe.message({
            taskId,
            contextId,
            parts: [sdk.describe.part.data({ ...content })],
            metadata,
        });
    }

    return sdk.describe.message({
        taskId,
        contextId,
        parts: [sdk.describe.part.text(JSON.stringify(content))],
        metadata,
    });
}
