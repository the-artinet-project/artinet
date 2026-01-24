import { RelayServer } from '@artinet/agent-relay-mcp';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as express from 'express';
import * as sdk from '@artinet/sdk';

export async function handleMCP(
    relay: RelayServer,
    req: express.Request,
    res: express.Response,
    getTransport: (req: express.Request) => Promise<StreamableHTTPServerTransport>,
): Promise<void> {
    const transport = await getTransport(req);
    if (!transport) {
        const error = sdk.INTERNAL_ERROR({ message: 'No transport found' });
        sdk.logger.error('handleMCP', error);
        throw error;
    }
    await relay.connect(transport);
    await transport.handleRequest(req, res);
}
