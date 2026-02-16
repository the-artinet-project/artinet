/**
 * OpenClaw Gateway Integration Tests
 *
 * These tests hit a running OpenClaw gateway over WebSocket.
 */
import { describe, it, expect } from '@jest/globals';
import { INTEGRATION_TIMEOUT } from '../setup';
import { dock } from '../../src/openclaw';
import { serve, createMessenger, AgentMessenger } from '@artinet/sdk';

const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? 'ws://127.0.0.1:18789';
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN ?? 'dev-local-token';

describe('OpenClaw Integration', () => {
    it(
        'should connect to OpenClaw gateway and run an agent turn',
        async () => {
            const a2agent = await dock(
                {
                    name: 'OpenClaw Test Agent',
                    gatewayUrl,
                    authToken: gatewayToken,
                    agentId: 'main',
                },
                { name: 'OpenClaw Test Agent' },
                {
                    connectTimeoutMs: 10_000,
                    timeoutMs: 20_000,
                },
            );

            const task = await a2agent.sendMessage('Reply with a short ping message.');
            const status = (task as any).status;
            const state = status?.state;
            const messageText = status?.message?.parts?.[0]?.text;

            expect(state).toBe('completed');
            console.log('messageText', messageText);
            expect(typeof messageText).toBe('string');
            expect(messageText.length).toBeGreaterThan(0);
            expect(messageText.toLowerCase()).not.toContain('error');
            expect(messageText).not.toContain('connect rejected');
        },
        INTEGRATION_TIMEOUT,
    );
    it(
        'should connect to OpenClaw gateway and via an A2A server',
        async () => {
            const a2agent = await dock(
                {
                    name: 'OpenClaw Test Agent',
                    gatewayUrl,
                    authToken: gatewayToken,
                    agentId: 'main',
                },
                { name: 'OpenClaw Test Agent', url: `http://localhost:3001` },
                {
                    connectTimeoutMs: 10_000,
                    timeoutMs: 20_000,
                },
            );

            serve({ agent: a2agent, port: 3001 }).start();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const messenger: AgentMessenger = await createMessenger({
                baseUrl: `http://localhost:3001`,
            });

            const task = await messenger.sendMessage('Reply with a short ping message.');
            const status = (task as any).status;
            const state = status?.state;
            const messageText = status?.message?.parts?.[0]?.text;

            expect(state).toBe('completed');
            console.log('messageText', messageText);
            expect(typeof messageText).toBe('string');
            expect(messageText.length).toBeGreaterThan(0);
            expect(messageText.toLowerCase()).not.toContain('error');
            expect(messageText).not.toContain('connect rejected');
        },
        INTEGRATION_TIMEOUT,
    );
});
