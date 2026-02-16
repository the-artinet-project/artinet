import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getAgentCard, convertToCoreMessage } from '../../src/mastra/utils';
import type * as sdk from '@artinet/sdk';

// Mock MastraAgent
const createMockAgent = (
    overrides: {
        id?: string;
        instructions?: string | { content: string }[] | { content: string };
        tools?: Record<string, { description?: string }>;
    } = {},
) => ({
    id: overrides.id ?? 'test-agent',
    getInstructions: jest
        .fn<() => Promise<string | { content: string }[] | { content: string }>>()
        .mockResolvedValue(overrides.instructions ?? 'Test instructions'),
    listTools: jest
        .fn<() => Promise<Record<string, { description?: string }>>>()
        .mockResolvedValue(overrides.tools ?? {}),
});

describe('utils', () => {
    describe('getAgentCard', () => {
        it('should create an agent card with basic agent info', async () => {
            const mockAgent = createMockAgent({
                id: 'my-test-agent',
                instructions: 'You are a helpful assistant',
            });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: { name: 'Test Agent' },
            });

            expect(card.name).toBe('Test Agent');
            expect(card.description).toBe('You are a helpful assistant');
            expect(card.capabilities.streaming).toBe(true);
            expect(card.capabilities.pushNotifications).toBe(true);
            expect(card.capabilities.stateTransitionHistory).toBe(false);
            expect(card.defaultInputModes).toEqual(['text']);
            expect(card.defaultOutputModes).toEqual(['text']);
        });

        it('should use agent id as name when card is a string', async () => {
            const mockAgent = createMockAgent({ id: 'agent-123' });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: 'Custom Name',
            });

            expect(card.name).toBe('Custom Name');
        });

        it('should fallback to agent id when no card name provided', async () => {
            const mockAgent = createMockAgent({ id: 'fallback-agent' });

            const card = await getAgentCard({
                agent: mockAgent as any,
            });

            expect(card.name).toBe('fallback-agent');
        });

        it('should convert tools to skills', async () => {
            const mockAgent = createMockAgent({
                tools: {
                    search: { description: 'Search the web' },
                    calculate: { description: 'Perform calculations' },
                },
            });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: { name: 'Tool Agent' },
            });

            expect(card.skills).toHaveLength(2);
            expect(card.skills).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'search',
                        name: 'search',
                        description: 'Search the web',
                        tags: ['tool'],
                    }),
                    expect.objectContaining({
                        id: 'calculate',
                        name: 'calculate',
                        description: 'Perform calculations',
                        tags: ['tool'],
                    }),
                ]),
            );
        });

        it('should use default tool description when not provided', async () => {
            const mockAgent = createMockAgent({
                tools: {
                    unknownTool: {},
                },
            });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: { name: 'Agent' },
            });

            expect(card.skills[0].description).toBe('Tool: unknownTool');
        });

        it('should handle array of instruction messages', async () => {
            const mockAgent = createMockAgent({
                instructions: [{ content: 'First instruction' }, { content: 'Second instruction' }],
            });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: { name: 'Agent' },
            });

            expect(card.description).toBe('First instruction\nSecond instruction');
        });

        it('should handle single instruction object', async () => {
            const mockAgent = createMockAgent({
                instructions: { content: 'Single instruction' },
            });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: { name: 'Agent' },
            });

            expect(card.description).toBe('Single instruction');
        });

        it('should handle empty instructions', async () => {
            const mockAgent = createMockAgent({
                instructions: '',
            });

            const card = await getAgentCard({
                agent: mockAgent as any,
                card: { name: 'Agent' },
            });

            expect(card.description).toBe('');
        });
    });

    describe('convertToCoreMessage', () => {
        it('should convert user message with text part', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-1',
                role: 'user',
                parts: [{ kind: 'text', text: 'Hello, agent!' }],
            };

            const coreMessage = convertToCoreMessage(a2aMessage);

            expect(coreMessage.role).toBe('user');
            expect(coreMessage.content).toEqual([{ type: 'text', text: 'Hello, agent!' }]);
        });

        it('should convert agent message to assistant role', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-2',
                role: 'agent',
                parts: [{ kind: 'text', text: 'Hello, user!' }],
            };

            const coreMessage = convertToCoreMessage(a2aMessage);

            expect(coreMessage.role).toBe('assistant');
            expect(coreMessage.content).toEqual([{ type: 'text', text: 'Hello, user!' }]);
        });

        it('should handle multiple text parts', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-3',
                role: 'user',
                parts: [
                    { kind: 'text', text: 'First part' },
                    { kind: 'text', text: 'Second part' },
                ],
            };

            const coreMessage = convertToCoreMessage(a2aMessage);

            expect(coreMessage.content).toHaveLength(2);
            expect(coreMessage.content).toEqual([
                { type: 'text', text: 'First part' },
                { type: 'text', text: 'Second part' },
            ]);
        });

        it('should convert file part with URI', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-4',
                role: 'user',
                parts: [
                    {
                        kind: 'file',
                        file: {
                            uri: 'https://example.com/image.png',
                            mimeType: 'image/png',
                        },
                    },
                ],
            };

            const coreMessage = convertToCoreMessage(a2aMessage);

            expect(coreMessage.content).toHaveLength(1);
            expect(coreMessage.content[0]).toEqual({
                type: 'file',
                data: new URL('https://example.com/image.png'),
                mimeType: 'image/png',
            });
        });

        it('should convert file part with bytes', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-5',
                role: 'user',
                parts: [
                    {
                        kind: 'file',
                        file: {
                            bytes: 'base64encodeddata',
                            mimeType: 'application/pdf',
                        },
                    },
                ],
            };

            const coreMessage = convertToCoreMessage(a2aMessage);

            expect(coreMessage.content).toHaveLength(1);
            expect(coreMessage.content[0]).toEqual({
                type: 'file',
                data: 'base64encodeddata',
                mimeType: 'application/pdf',
            });
        });

        it('should throw error for data parts', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-6',
                role: 'user',
                parts: [
                    {
                        kind: 'data',
                        data: { key: 'value' },
                    } as any,
                ],
            };

            expect(() => convertToCoreMessage(a2aMessage)).toThrow('Data parts are not supported in core messages');
        });

        it('should handle mixed part types', () => {
            const a2aMessage: sdk.A2A.Message = {
                messageId: 'msg-7',
                role: 'user',
                parts: [
                    { kind: 'text', text: 'Check this image:' },
                    {
                        kind: 'file',
                        file: {
                            uri: 'https://example.com/photo.jpg',
                            mimeType: 'image/jpeg',
                        },
                    },
                ],
            };

            const coreMessage = convertToCoreMessage(a2aMessage);

            expect(coreMessage.content).toHaveLength(2);
            expect(coreMessage.content[0]).toEqual({
                type: 'text',
                text: 'Check this image:',
            });
            expect(coreMessage.content[1]).toEqual({
                type: 'file',
                data: new URL('https://example.com/photo.jpg'),
                mimeType: 'image/jpeg',
            });
        });
    });
});
