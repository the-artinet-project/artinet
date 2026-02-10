/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as hono from 'hono';
import * as sdk from '@artinet/sdk';
import { ResultOrError } from '../../types.js';
import { streamSSE } from 'hono/streaming';
import { toJSONRPCResponse } from '../../utils.js';

/**
 * Handle JSON-RPC response for Hono.
 *
 * Used by the deployment server to provide a standard agent endpoint interface.
 *
 * @module server/handlers/rpc
 */
export async function handleJSONRPCResponse(
    ctx: hono.Context,
    id: string,
    method: string,
    response: ResultOrError,
): Promise<void> {
    if (response.type === 'success' && method === 'agentcard/get') {
        ctx.status(200);
        ctx.res = ctx.json(response.result);
        return;
    }

    if (response.type === 'success') {
        ctx.status(200);
        ctx.res = ctx.json(toJSONRPCResponse(String(id), response));
        return;
    }

    if (response.type === 'error') {
        ctx.status(500);
        ctx.res = ctx.json(toJSONRPCResponse(String(id), response));
        return;
    }

    if (response.type === 'stream') {
        const stream = response.stream;
        ctx.res = streamSSE(ctx, async (responseStream) => {
            for await (const data of stream) {
                responseStream.writeSSE({
                    data: JSON.stringify({ jsonrpc: '2.0', id, result: data }),
                });
            }
            responseStream.close();
        });
        ctx.status(200);
        ctx.res.headers.set('Content-Type', 'text/event-stream');
        ctx.res.headers.set('Cache-Control', 'no-cache');
        ctx.res.headers.set('Connection', 'keep-alive');
        return;
    }

    throw sdk.INTERNAL_ERROR({ message: 'Unknown response type' });
}
