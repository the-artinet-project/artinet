/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sdk from '@artinet/sdk';
import {
    TestAgent,
    TestAgentRoute,
    TestRequestSchema,
    TestRequest,
    TestAgentMount,
} from '../../routes/request/index.js';
import { v4 as uuidv4 } from 'uuid';
import { handleJSONRPCResponse } from './rpc.js';
import { generateRequestId } from './utils.js';
import { Session } from './types.js';

export type Mount = TestAgentMount<Session>;

const MAX_TEST_ID_ATTEMPTS = 10;

const getTestId = async (context: Omit<TestAgentRoute['context'], 'agentId'>) => {
    let testId = uuidv4();
    let free = false;
    for (let i = 0; i < MAX_TEST_ID_ATTEMPTS; i++) {
        if (await context.storage.get(testId)) {
            testId = uuidv4();
        } else {
            free = true;
            break;
        }
    }
    if (!free) {
        throw sdk.INTERNAL_ERROR({
            message: `Failed to find a free test agent ID after ${MAX_TEST_ID_ATTEMPTS} attempts`,
            id: testId,
        });
    }
    return testId;
};

export const factory: Mount['factory'] =
    ({ implementation = TestAgent }: { implementation: TestAgentRoute['implementation'] }): Mount['handler'] =>
    async (params): Promise<void> =>
        await handle(params, implementation);

export const handle: Mount['handler'] = async (
    { session: { ctx }, context, intercepts },
    implementation: TestAgentRoute['implementation'] = TestAgent,
): Promise<void> => {
    /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
    const req = sdk.safeParse(await ctx.req.text());
    let parsed: Omit<TestRequest, 'method' | 'params'> = await sdk.validateSchema(TestRequestSchema, req);

    let id = parsed.id ?? uuidv4();
    parsed.id = id;

    let request: TestAgentRoute['request'] = parsed as TestAgentRoute['request'];
    context.target = parsed.config;
    request.method = 'test/invoke';
    request.params = null;

    const response: TestAgentRoute['response'] = await implementation(request, context, intercepts);

    return await handleJSONRPCResponse(ctx, String(id), request.method, response);
};

export const request: Mount['request'] = async (
    { session, context, handler = handle, user, intercepts },
    implementation: TestAgentRoute['implementation'] = TestAgent,
): Promise<void> => {
    const { ctx } = session;
    /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
    const reqId = ctx.req.header('x-request-id') ?? sdk.safeParse(await ctx.req.text())?.id;
    const _context: TestAgentRoute['context'] = {
        ...context,
        agentId: await getTestId(context),
        requestId: generateRequestId(context, reqId),
        userId: await user?.(session),
    };
    return await handler({ session, context: _context, intercepts }, implementation);
};
