/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodRegistrationSchema, IRegistration } from '@artinet/metadata-validator';
import { z } from 'zod/v4';

const DEFAULT_BASE_URL = 'https://api.artinet.io';

export interface ServerConfig {
    baseUrl?: string;
}

interface LambdaResponse {
    statusCode: number;
    body: string;
}

export class ArtinetApiServer extends McpServer {
    private baseUrl: string;

    constructor(config: ServerConfig = {}) {
        super(
            { name: 'artinet-api', version: '0.1.0' },
            {
                instructions: `Artinet API server for agent registration and search.

register - Register an agent with the Artinet network. Requires a registration payload containing agent metadata.
search - Search for agents by keywords. Returns matching agent registrations with their details.`,
            },
        );
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
        this.setup();
    }

    private parseResponse<T>(response: unknown): T {
        if (typeof response === 'object' && response !== null && 'body' in response) {
            const body = (response as LambdaResponse).body;
            if (typeof body === 'string' && body.startsWith('{')) {
                return JSON.parse(body) as T;
            }
        }
        return response as T;
    }

    private setup(): void {
        this.registerTool(
            'register',
            {
                title: 'Register Agent',
                description: 'Register an agent with the Artinet network',
                inputSchema: zodRegistrationSchema,
            },
            async (args) => {
                console.error(args);
                const result = await this.register(args as IRegistration);
                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            },
        );

        this.registerTool(
            'search',
            {
                title: 'Search Agents',
                description: 'Search for agents by keywords (max 10 queries)',
                inputSchema: z.object({
                    searchQueries: z.array(z.string()).max(10).describe('Keywords to search for agents'),
                    searchSize: z.number().optional().describe('Number of results to return'),
                    cursor: z
                        .object({
                            startIndex: z.number(),
                            batchSize: z.number(),
                        })
                        .optional()
                        .describe('Pagination cursor'),
                }),
            },
            async ({ searchQueries, searchSize, cursor }) => {
                const result = await this.search(searchQueries, searchSize, cursor);
                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    private async register(
        registrationPayload: IRegistration,
    ): Promise<{ success: boolean; registrationId?: string; error?: string }> {
        const response = await fetch(`${this.baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationPayload: JSON.stringify({ ...registrationPayload }) }),
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        const raw = await response.json();
        const data = this.parseResponse<{ registrationResponse?: { success: boolean; registrationId?: string } }>(raw);
        return {
            success: data.registrationResponse?.success ?? false,
            registrationId: data.registrationResponse?.registrationId,
        };
    }

    private async search(
        searchQueries: string[],
        searchSize?: number,
        cursor?: { startIndex: number; batchSize: number },
    ): Promise<{
        searchResults: Record<string, unknown>;
        searchNumResults: number;
        searchCursor?: { startIndex: number; batchSize: number };
    }> {
        const response = await fetch(`${this.baseUrl}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchQueries, searchSize, cursor }),
        });

        if (!response.ok) {
            return { searchResults: {}, searchNumResults: 0 };
        }

        const raw = await response.json();
        const data = this.parseResponse<{
            searchResults?: Record<string, unknown>;
            searchNumResults?: number;
            searchCursor?: { startIndex: number; batchSize: number };
        }>(raw);

        return {
            searchResults: data.searchResults ?? {},
            searchNumResults: data.searchNumResults ?? 0,
            searchCursor: data.searchCursor,
        };
    }

    static create(config: ServerConfig = {}): ArtinetApiServer {
        return new ArtinetApiServer(config);
    }
}
