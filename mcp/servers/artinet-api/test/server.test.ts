import { ArtinetApiServer } from '../src/server.js';

const API_URL = 'https://api.artinet.io';
const TEST_TIMEOUT = 30000;

// The API returns Lambda-wrapped responses - parse body if present
async function fetchApi<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const raw = await response.json();
    // API returns { body: string, statusCode, headers } format
    if (raw && typeof raw === 'object' && 'body' in raw && typeof raw.body === 'string') {
        return JSON.parse(raw.body) as T;
    }
    return raw as T;
}

describe('ArtinetApiServer', () => {
    let server: ArtinetApiServer;

    beforeAll(() => {
        server = ArtinetApiServer.create({ baseUrl: API_URL });
    });

    describe('instantiation', () => {
        it('should create server instance', () => {
            expect(server).toBeInstanceOf(ArtinetApiServer);
        });

        it('should accept custom base URL', () => {
            const customServer = ArtinetApiServer.create({ baseUrl: 'http://localhost:3000' });
            expect(customServer).toBeInstanceOf(ArtinetApiServer);
        });
    });

    describe('search', () => {
        it(
            'should search for agents by keyword',
            async () => {
                const data = await fetchApi<{
                    searchResults: Record<string, unknown>;
                    searchNumResults: number;
                }>(`${API_URL}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchQueries: ['agent'], searchSize: 5 }),
                });

                expect(data).toHaveProperty('searchResults');
                expect(data).toHaveProperty('searchNumResults');
                expect(typeof data.searchNumResults).toBe('number');
            },
            TEST_TIMEOUT,
        );

        it(
            'should return empty results for nonsense query',
            async () => {
                const data = await fetchApi<{
                    searchResults: Record<string, unknown>;
                    searchNumResults: number;
                }>(`${API_URL}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchQueries: ['xyznonexistent123456789abc'] }),
                });

                expect(data.searchNumResults).toBe(0);
                expect(data.searchResults).toEqual({});
            },
            TEST_TIMEOUT,
        );

        it(
            'should support pagination with cursor',
            async () => {
                const data = await fetchApi<{
                    searchResults: Record<string, unknown>;
                    searchCursor: { startIndex: number; batchSize: number };
                }>(`${API_URL}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        searchQueries: ['test'],
                        searchSize: 2,
                        cursor: { startIndex: 0, batchSize: 2 },
                    }),
                });

                expect(data).toHaveProperty('searchResults');
                expect(data).toHaveProperty('searchCursor');
            },
            TEST_TIMEOUT,
        );

        it(
            'should limit results with searchSize',
            async () => {
                const data = await fetchApi<{ searchResults: Record<string, unknown> }>(`${API_URL}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchQueries: ['agent'], searchSize: 2 }),
                });

                const resultCount = Object.keys(data.searchResults).length;
                expect(resultCount).toBeLessThanOrEqual(2);
            },
            TEST_TIMEOUT,
        );
    });

    describe('search-ids', () => {
        it(
            'should return registration IDs array',
            async () => {
                const data = await fetchApi<{ searchResults: string[] }>(`${API_URL}/search-ids`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchQueries: ['agent'] }),
                });

                expect(data).toHaveProperty('searchResults');
                expect(Array.isArray(data.searchResults)).toBe(true);
            },
            TEST_TIMEOUT,
        );

        it(
            'should return hex registration IDs',
            async () => {
                const data = await fetchApi<{ searchResults: string[] }>(`${API_URL}/search-ids`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchQueries: ['test'] }),
                });

                if (data.searchResults.length > 0) {
                    expect(data.searchResults[0]).toMatch(/^0x[a-fA-F0-9]+$/);
                }
            },
            TEST_TIMEOUT,
        );
    });

    describe('register', () => {
        it(
            'should accept valid registration payload',
            async () => {
                const registrationPayload = {
                    schemaVersion: '1.0.1',
                    serviceName: `mcp-integration-test-${Date.now()}`,
                    description: 'MCP server integration test agent',
                    version: '1.0.0',
                    capabilities: ['test', 'integration'],
                    communication: {
                        endpoints: [
                            {
                                url: 'https://example.com/test-agent',
                                type: 'http',
                                authentication: false,
                            },
                        ],
                    },
                    tags: ['test', 'mcp', 'integration'],
                };

                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registrationPayload: JSON.stringify(registrationPayload) }),
                });
                expect(response.ok).toBe(true);
                expect(response.status).toBe(200);
                const contentType = response.headers.get('content-type') ?? '';
                expect(contentType.includes('application/json')).toBe(true);
                const raw = await response.json();
                let data: { registrationResponse?: { success: boolean; registrationId?: string } };
                if (raw && typeof raw === 'object' && 'body' in raw) {
                    data = JSON.parse((raw as { body: string }).body);
                } else {
                    data = raw as typeof data;
                }
                expect(data).toHaveProperty('registrationResponse');
                if (data.registrationResponse?.success) {
                    expect(data.registrationResponse.registrationId).toBeDefined();
                    expect(data.registrationResponse.registrationId).toMatch(/^0x[a-fA-F0-9]+$/);
                }
            },
            TEST_TIMEOUT,
        );

        it(
            'should reject malformed payload',
            async () => {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registrationPayload: JSON.stringify({ invalid: true }) }),
                });

                expect(response.ok).toBe(false);
                expect(response.status).toBe(500);
            },
            TEST_TIMEOUT,
        );
    });
});
