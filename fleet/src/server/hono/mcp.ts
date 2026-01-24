import { RelayServer } from '@artinet/agent-relay-mcp';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import * as hono from 'hono';
import * as sdk from '@artinet/sdk';

export async function handleMCP(
    relay: RelayServer,
    ctx: hono.Context,
    getTransport: (ctx: hono.Context) => Promise<WebStandardStreamableHTTPServerTransport>,
): Promise<Response> {
    const transport = await getTransport(ctx);
    if (!transport) {
        const error = sdk.INTERNAL_ERROR({ message: 'No transport found' });
        sdk.logger.error('handleMCP', error);
        throw error;
    }
    await relay.connect(transport);
    return await transport.handleRequest(ctx.req.raw);
}
