#!/usr/bin/env node
import { ArtinetApiServer } from '../src/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const baseUrl = process.env.ARTINET_API_URL ?? process.argv[2];

const server = ArtinetApiServer.create({ baseUrl });

async function run(): Promise<void> {
    console.error('Starting Artinet API MCP Server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

run().catch((error) => {
    console.error('Error starting server:', error);
    process.exit(1);
});
