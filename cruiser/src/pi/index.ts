/**
 * @fileoverview pi-agent-core → artinet
 *
 * @module @artinet/cruiser/pi-agent-core
 * @description
 * This adapter "docks" {@link PiAgent | pi-agent-core Agents} (from `@mariozechner/pi-agent-core`) into the
 * artinet, enabling them to participate in multi-agent workflows.
 *
 * ## Design Decisions
 *
 * 1. **State Rehydration**: Before each execution we replay A2A task history into
 *    `agent.state.messages` via `replaceMessages(...)`. This keeps pi-agent-core's
 *    internal state aligned with Artinet conversation continuity.
 *
 * 2. **Prompt-First Execution**: Uses `agent.prompt(inputText)` as the canonical entry
 *    point. This follows pi-agent-core's event loop model and allows tool execution
 *    and follow-up turns to remain managed by the framework.
 *
 * 3. **Assistant Message Extraction**: After prompt execution, we select the latest
 *    assistant message from `agent.state.messages` and normalize it into plain text
 *    for A2A response parts.
 *
 * 4. **Error-Explicit Failures**: Empty input, prompt exceptions, and missing assistant
 *    output are surfaced as explicit failed task updates, preserving predictable A2A
 *    state transitions for callers.
 *
 * ## Usage
 *
 * ```typescript
 * import { Agent } from "@mariozechner/pi-agent-core";
 * import { getModel } from "@mariozechner/pi-ai";
 * import { dock } from "@artinet/cruiser/pi-agent-core";
 * import { serve } from "@artinet/sdk";
 *
 * const piAgent = new Agent({
 *   initialState: {
 *     systemPrompt: "You are a helpful assistant",
 *     model: getModel("openai", "gpt-4o-mini"),
 *   },
 * });
 *
 * const artinetAgent = await dock(piAgent, { name: "Pi Agent" });
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 */

import type { Agent as PiAgent } from '@mariozechner/pi-agent-core';
import * as sdk from '@artinet/sdk';
import { Dock } from '../corsair.js';
import { convertToPiMessage, createMetadata, extractA2AMessage, getAgentCard } from './utils.js';

export type PiAgentOptions = never;

/**
 * Docks a `pi-agent-core` {@link PiAgent} onto artinet.
 *
 * ## Execution Contract
 *
 * - Rehydrates pi-agent-core message state from A2A task history on every request
 * - Invokes the agent using `prompt(...)` with extracted user text
 * - Publishes explicit A2A failed/completed updates for deterministic downstream behavior
 *
 * ## Notes
 *
 * The adapter currently does not expose extra dock-level runtime options.
 * `pi-agent-core` runtime behavior (model, tools, prompt steering, follow-ups)
 * should be configured directly on the `Agent` instance.
 *
 * @param agent - The `pi-agent-core` Agent instance to dock.
 * @param card - Optional A2A card overrides for name, description, and skills.
 * @returns A Promise resolving to an artinet-compatible {@link sdk.Agent}.
 */
export const dock: Dock<PiAgent, PiAgentOptions> = async (
    agent: PiAgent,
    card?: sdk.A2A.AgentCardParams,
): Promise<sdk.Agent> => {
    const agentCard = await getAgentCard({ agent, card });
    sdk.logger.debug(`PiAgentCore[${agentCard.name}]:[card:${JSON.stringify(agentCard)}]`);
    const metadata = createMetadata(agent);
    return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
        sdk.logger.debug(`PiAgentCore[${agentCard.name}]:[context:${context.contextId}]: starting`);

        const task = await context.getTask();
        const history = sdk.getLatestHistory(task);

        agent.replaceMessages(history.map(convertToPiMessage));
        const inputText = sdk.extractTextContent(context.userMessage, false);
        if (!inputText || inputText.trim().length === 0) {
            yield sdk.describe.update.failed({
                taskId: context.taskId,
                contextId: context.contextId,
                message: sdk.describe.message({
                    taskId: context.taskId,
                    contextId: context.contextId,
                    parts: [sdk.describe.part.text('no input text detected')],
                    metadata,
                }),
            });
            return;
        }

        try {
            await agent.prompt(inputText);
        } catch (error) {
            sdk.logger.error('error invoking Pi agent', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            yield sdk.describe.update.failed({
                taskId: context.taskId,
                contextId: context.contextId,
                message: sdk.describe.message({
                    taskId: context.taskId,
                    contextId: context.contextId,
                    parts: [sdk.describe.part.text(`error invoking Pi agent: ${errorMessage}`)],
                    metadata: {
                        ...(task.metadata ?? {}),
                        ...(metadata ?? {}),
                        error: errorMessage,
                    },
                }),
            });
            return;
        }

        const assistantMessage = [...agent.state.messages]
            .reverse()
            .find(
                (message) =>
                    typeof message === 'object' &&
                    message !== null &&
                    (message as { role?: unknown }).role === 'assistant',
            );
        if (!assistantMessage) {
            yield sdk.describe.update.failed({
                taskId: context.taskId,
                contextId: context.contextId,
                message: sdk.describe.message({
                    taskId: context.taskId,
                    contextId: context.contextId,
                    parts: [sdk.describe.part.text('no response from Pi agent')],
                    metadata,
                }),
            });
            return;
        }

        const responseMessage = extractA2AMessage(assistantMessage, context.taskId, context.contextId, metadata);

        yield sdk.describe.update.completed({
            taskId: context.taskId,
            contextId: context.contextId,
            message: responseMessage,
            metadata: {
                ...(task.metadata ?? {}),
                ...(metadata ?? {}),
                result: {
                    messageCount: agent.state.messages.length,
                    pendingToolCalls: Array.from(agent.state.pendingToolCalls),
                    error: agent.state.error,
                },
            },
        });
    });
};

export type { PiAgent };
