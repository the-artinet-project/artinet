import { describe, expect, it } from '@jest/globals';
import type * as sdk from '@artinet/sdk';
import { convertToPiMessage, getAgentCard, extractA2AMessage, createMetadata } from '../../src/pi/utils';

function createMockAgent(
    overrides: {
        systemPrompt?: string;
        tools?: Array<{ name: string; label?: string; description?: string }>;
    } = {},
): any {
    return {
        state: {
            systemPrompt: overrides.systemPrompt ?? 'You are a helpful assistant',
            tools: overrides.tools ?? [],
            model: {
                id: 'model-1',
                name: 'Model 1',
                api: 'openai',
                provider: 'openai',
                baseUrl: 'https://api.openai.com/v1',
                reasoning: false,
                cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    total: 0,
                },
            },
        },
    };
}

const mockMetadata = createMetadata(createMockAgent());

describe('pi-agent-core utils', () => {
    describe('getAgentCard', () => {
        it('creates an agent card with explicit name override', async () => {
            const card = await getAgentCard({
                agent: createMockAgent({
                    systemPrompt: 'You are a focused coding assistant',
                }),
                card: { name: 'Pi Assistant' },
            });

            expect(card.name).toBe('Pi Assistant');
            expect(card.description).toBe('You are a focused coding assistant');
            expect(card.capabilities.streaming).toBe(true);
            expect(card.capabilities.pushNotifications).toBe(true);
            expect(card.capabilities.stateTransitionHistory).toBe(false);
            expect(card.defaultInputModes).toEqual(['text']);
            expect(card.defaultOutputModes).toEqual(['text']);
        });

        it('maps tools to skills', async () => {
            const card = await getAgentCard({
                agent: createMockAgent({
                    tools: [
                        {
                            name: 'search_docs',
                            label: 'Search Docs',
                            description: 'Searches documentation',
                        },
                        {
                            name: 'run_command',
                        },
                    ],
                }),
            });

            expect(card.skills).toEqual([
                {
                    id: 'search_docs',
                    name: 'Search Docs',
                    description: 'Searches documentation',
                    tags: ['tool'],
                },
                {
                    id: 'run_command',
                    name: 'run_command',
                    description: 'A tool that can be used to run_command',
                    tags: ['tool'],
                },
            ]);
        });
    });

    describe('convertToPiMessage', () => {
        it('converts user A2A message to user pi-agent-core message', () => {
            const a2aMessage: sdk.A2A.Message = {
                kind: 'message',
                messageId: 'msg-1',
                role: 'user',
                parts: [{ kind: 'text', text: 'hello world' }],
            };

            const message = convertToPiMessage(a2aMessage, 42);

            expect(message).toEqual({
                role: 'user',
                content: 'hello world',
                timestamp: 42,
            });
        });

        it('maps non-user role to assistant', () => {
            const a2aMessage: sdk.A2A.Message = {
                kind: 'message',
                messageId: 'msg-2',
                role: 'agent',
                parts: [{ kind: 'text', text: 'hi there' }],
            };

            const message = convertToPiMessage(a2aMessage, 100);
            expect(message).toEqual(
                expect.objectContaining({
                    role: 'assistant',
                    api: 'openai-responses',
                    provider: 'unknown',
                    model: 'unknown',
                    stopReason: 'stop',
                    timestamp: 100,
                }),
            );
            expect((message as any).content).toEqual([{ type: 'text', text: 'hi there' }]);
        });
    });

    describe('extractA2AMessage', () => {
        it('extracts string content', () => {
            const message = extractA2AMessage(
                {
                    role: 'assistant',
                    content: 'plain text',
                    timestamp: Date.now(),
                } as any,
                'task-1',
                'ctx-1',
                mockMetadata,
            );
            expect(message.parts[0].kind).toBe('text');
            if (message.parts[0].kind === 'text') {
                expect(message.parts[0].text).toBe('plain text');
            }
        });

        it('extracts text blocks from array content', () => {
            const message = extractA2AMessage(
                {
                    role: 'assistant',
                    content: [
                        { type: 'text', text: 'first line' },
                        { type: 'tool_call', toolName: 'search' },
                        { type: 'text', text: 'second line' },
                    ],
                    timestamp: Date.now(),
                } as any,
                'task-1',
                'ctx-1',
                mockMetadata,
            );
            expect(message.parts[0].kind).toBe('text');
            if (message.parts[0].kind === 'text') {
                expect(message.parts[0].text).toBe('first line');
            }
            expect(message.parts[1].kind).toBe('data');
            if (message.parts[1].kind === 'data') {
                expect(message.parts[1].data).toEqual({ type: 'tool_call', toolName: 'search' });
            }
            expect(message.parts[2].kind).toBe('text');
            if (message.parts[2].kind === 'text') {
                expect(message.parts[2].text).toBe('second line');
            }
        });

        it('returns empty string when content is not text-compatible', () => {
            const message = extractA2AMessage(
                {
                    role: 'assistant',
                    content: [{ type: 'tool_call', toolName: 'search' }],
                    timestamp: Date.now(),
                } as any,
                'task-1',
                'ctx-1',
                mockMetadata,
            );
            expect(message.parts[0].kind).toBe('data');
            if (message.parts[0].kind === 'data') {
                expect(message.parts[0].data).toEqual({ type: 'tool_call', toolName: 'search' });
            }
        });
    });
});
