import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import { jest, describe, it, expect, afterAll, beforeAll } from '@jest/globals';

jest.setTimeout(30000);

const STDIO_ARGS = ['dist/bin/stdio.js'];

describe('ArtinetApiServer STDIO', () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
        transport = new StdioClientTransport({
            command: 'node',
            args: STDIO_ARGS,
        });
        client = new Client({ name: 'Artinet API Test Client', version: '1.0.0' }, {});
        await client.connect(transport);
    });

    afterAll(async () => {
        await transport?.close();
        await client?.close();
    });

    describe('tool discovery', () => {
        it('should list available tools', async () => {
            const response = (await client.listTools()) as ListToolsResult;
            expect(response.tools).toBeDefined();
            expect(response.tools.length).toBeGreaterThanOrEqual(2);

            const toolNames = response.tools.map((t) => t.name);
            expect(toolNames).toContain('register');
            expect(toolNames).toContain('search');
        });

        it('should have correct tool schemas', async () => {
            const response = (await client.listTools()) as ListToolsResult;

            const searchTool = response.tools.find((t) => t.name === 'search');
            expect(searchTool).toBeDefined();
            expect(searchTool?.inputSchema).toBeDefined();

            const registerTool = response.tools.find((t) => t.name === 'register');
            expect(registerTool).toBeDefined();
            expect(registerTool?.inputSchema).toBeDefined();
        });
    });

    describe('search tool', () => {
        it('should search for agents by keyword', async () => {
            const response = (await client.callTool({
                name: 'search',
                arguments: {
                    searchQueries: ['agent'],
                    searchSize: 3,
                },
            })) as CallToolResult;

            expect(response.content).toBeDefined();
            expect(response.content.length).toBeGreaterThan(0);
            const textContent = response.content[0];
            expect(textContent.type).toBe('text');

            const result = JSON.parse((textContent as { type: 'text'; text: string }).text);
            expect(result).toHaveProperty('searchResults');
            expect(result).toHaveProperty('searchNumResults');
            expect(typeof result.searchNumResults).toBe('number');
        });

        it('should return empty results for nonsense query', async () => {
            const response = (await client.callTool({
                name: 'search',
                arguments: {
                    searchQueries: ['xyznonexistent987654321abc'],
                },
            })) as CallToolResult;

            const textContent = response.content[0] as { type: 'text'; text: string };
            const result = JSON.parse(textContent.text);

            expect(result.searchNumResults).toBe(0);
            expect(result.searchResults).toEqual({});
        });

        it('should support pagination cursor', async () => {
            const response = (await client.callTool({
                name: 'search',
                arguments: {
                    searchQueries: ['test'],
                    searchSize: 2,
                    cursor: { startIndex: 0, batchSize: 2 },
                },
            })) as CallToolResult;

            const textContent = response.content[0] as { type: 'text'; text: string };
            const result = JSON.parse(textContent.text);

            expect(result).toHaveProperty('searchResults');
            expect(result).toHaveProperty('searchCursor');
        });
    });

    describe('register tool', () => {
        it('should accept valid registration payload', async () => {
            const registrationPayload = {
                schemaVersion: '1.0.1',
                serviceName: `mcp-stdio-test-${Date.now()}`,
                description: 'MCP STDIO integration test agent',
                version: '1.0.0',
                capabilities: ['test', 'stdio'],
                communication: {
                    endpoints: [
                        {
                            url: 'https://example.com/stdio-test-agent',
                            type: 'http',
                            authentication: false,
                        },
                    ],
                },
                tags: ['test', 'mcp', 'stdio'],
            };

            const response = (await client.callTool({
                name: 'register',
                arguments: registrationPayload,
            })) as CallToolResult;

            expect(response.content).toBeDefined();
            expect(response.content.length).toBeGreaterThan(0);
            const textContent = response.content[0] as { type: 'text'; text: string };
            const result = JSON.parse(textContent.text);
            expect(result.success).toBe(true);
            expect(result.registrationId).toBeDefined();
            expect(result.registrationId).toMatch(/^0x[a-fA-F0-9]+$/);
        });

        it('should reject invalid registration payload', async () => {
            const response = (await client.callTool({
                name: 'register',
                arguments: { invalid: true },
            })) as CallToolResult;

            // MCP returns isError: true for validation failures
            expect(response.isError).toBe(true);
            const textContent = response.content[0] as { type: 'text'; text: string };
            expect(textContent.text).toContain('validation error');
        });
    });
});
