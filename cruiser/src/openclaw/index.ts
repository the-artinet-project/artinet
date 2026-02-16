/**
 * @fileoverview openclaw → artinet
 *
 * @module @artinet/cruiser/openclaw
 * @description
 * This adapter "docks" OpenClaw Gateway agents into artinet.
 */

import * as sdk from '@artinet/sdk';
import { Dock, Park } from '../corsair.js';
import { OpenClawGatewayClient } from './client.js';
import { extractOpenClawText, getAgentCard, type OpenClawAgent } from './utils.js';

/**
 * Configuration options for OpenClaw Gateway WebSocket calls.
 */
export type OpenClawDockOptions = {
    /**
     * Timeout for WS connect handshake in milliseconds.
     */
    connectTimeoutMs?: number;
    /**
     * Timeout for gateway request completion in milliseconds.
     */
    timeoutMs?: number;
};

/**
 * @deprecated Use {@link OpenClawDockOptions} instead.
 */
export type OpenClawParkOptions = OpenClawDockOptions;

/**
 * Docks an OpenClaw Gateway agent into artinet.
 *
 * This adapter uses OpenClaw's native Gateway WebSocket protocol.
 *
 * OpenClaw docs:
 * https://docs.openclaw.ai/gateway/protocol
 */
export const dock: Dock<OpenClawAgent, OpenClawDockOptions> = async function dock(
    agent: OpenClawAgent,
    card?: sdk.A2A.AgentCardParams,
    options?: OpenClawDockOptions,
): Promise<sdk.Agent> {
    const agentCard = await getAgentCard({ agent, card });
    const gatewayUrl = (agent.gatewayUrl ?? 'ws://127.0.0.1:18789').replace(/\/+$/, '');
    const agentId = agent.agentId ?? 'main';
    const connectTimeoutMs =
        options?.connectTimeoutMs && options.connectTimeoutMs > 0 ? options.connectTimeoutMs : 10_000;
    const requestTimeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 60_000;

    const gateway = new OpenClawGatewayClient({
        url: gatewayUrl,
        authToken: agent.authToken,
        authPassword: agent.authPassword,
        agent,
        device: agent.device,
        scopes: agent.scopes,
        connectTimeoutMs,
    });

    await gateway.ensureConnected();

    sdk.logger.debug(`OpenClaw[${agentCard.name}]:[card:${JSON.stringify(agentCard)}]`);

    return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
        sdk.logger.debug(`OpenClaw[${agentCard.name}]:[context:${context.contextId}]: starting`);

        const task = await context.getTask();
        const text = sdk.extractTextContent(context.userMessage);
        if (!text || text.trim().length === 0) {
            yield sdk.describe.update.failed({
                taskId: context.taskId,
                contextId: context.contextId,
                message: sdk.describe.message({
                    taskId: context.taskId,
                    contextId: context.contextId,
                    parts: [sdk.describe.part.text('no input text detected')],
                }),
            });
            return;
        }

        try {
            const result = await gateway.requestAgentRun({
                message: text,
                agentId,
                sessionKey: agent.sessionKey ?? context.contextId,
                timeoutMs: requestTimeoutMs,
            });

            const responseText = extractOpenClawText(result);
            const message = sdk.describe.message({
                taskId: context.taskId,
                contextId: context.contextId,
                parts: [sdk.describe.part.text(responseText)],
            });

            yield sdk.describe.update.completed({
                taskId: context.taskId,
                contextId: context.contextId,
                message,
                metadata: {
                    ...(task.metadata ?? {}),
                    result,
                },
            });
        } catch (error) {
            sdk.logger.error('OpenClaw execution failed', error);
            const errorMessage = error instanceof Error ? error.message : String(error);

            yield sdk.describe.update.failed({
                taskId: context.taskId,
                contextId: context.contextId,
                message: sdk.describe.message({
                    taskId: context.taskId,
                    contextId: context.contextId,
                    parts: [sdk.describe.part.text(`error invoking OpenClaw agent: ${errorMessage}`)],
                    metadata: {
                        ...(task.metadata ?? {}),
                        error: errorMessage,
                    },
                }),
            });
        }
    });
};

/**
 * @deprecated Use {@link dock} instead.
 */
export const park: Park<OpenClawAgent, OpenClawDockOptions> = dock;

export type { OpenClawAgent } from './utils.js';
