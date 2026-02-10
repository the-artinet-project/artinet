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

/**
 * Handler utilities for agent test/evaluation requests.
 *
 * Exports a reusable handler function for routing test/evaluation requests to agent instances,
 * validating the request body, and returning the result as a JSON-RPC response.
 *
 * Used by the deployment server to provide a standard agent test/evaluation endpoint interface.
 *
 * @module server/handlers/test
 */

export type Mount = TestAgentMount<Session>;

const MAX_TEST_ID_ATTEMPTS = 10;
const generateTestId = async (context: Omit<TestAgentRoute['context'], 'agentId'>): Promise<string> => {
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
    { session: { request, response }, context },
    implementation: TestAgentRoute['implementation'] = TestAgent,
): Promise<void> => {
    let parsed: Omit<TestRequest, 'method' | 'params'> = await sdk.validateSchema(
        TestRequestSchema,
        request?.body ?? {},
    );

    let id = parsed.id ?? uuidv4();
    parsed.id = id;

    let req: TestAgentRoute['request'] = parsed as TestAgentRoute['request'];
    context.target = parsed.config;
    req.method = 'test/invoke';
    req.params = null;

    const res: TestAgentRoute['response'] = await implementation(req, context);

    return await handleJSONRPCResponse(response, String(id), req.method, res);
};

export const request: Mount['request'] = async (
    { session, context, handler = handle, user, intercepts },
    implementation: TestAgentRoute['implementation'] = TestAgent,
): Promise<void> => {
    const _context: TestAgentRoute['context'] = {
        ...context,
        agentId: await generateTestId(context),
        requestId: generateRequestId(context, session.request),
        userId: await user?.(session),
    };
    return await handler({ session, context: _context, intercepts }, implementation);
};
