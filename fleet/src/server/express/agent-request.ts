/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { INVALID_REQUEST } from '@artinet/sdk';
import { RequestAgent, RequestAgentRoute, RequestContext, RequestAgentMount } from '../../routes/request/index.js';
import * as sdk from '@artinet/sdk';
import { handleJSONRPCResponse } from './rpc.js';
import { generateRequestId } from './utils.js';
import { Session } from './types.js';
import { AGENT_FIELD_NAME } from '../../default.js';

/**
 * Handler utilities for agent HTTP requests.
 *
 * Exports a reusable handler function for routing requests to agent instances,
 * verifying agentId route param, and returning agent metadata
 * or dispatching to JSON-RPC middleware as appropriate.
 *
 * Used by the deployment server to provide a standard agent endpoint interface.
 *
 * @module server/handlers/agent
 */

export type Mount = RequestAgentMount<Session>;

export const factory: Mount['factory'] = ({
    implementation = RequestAgent,
}: {
    implementation: RequestAgentRoute['implementation'];
}) => {
    return async (params: {
        session: Session;
        context: RequestContext;
        intercepts?: RequestAgentRoute['intercept'][];
    }) => {
        return await handle(params, implementation);
    };
};

export const handle: Mount['handler'] = async (
    { session: { request, response }, context, intercepts },
    implementation: RequestAgentRoute['implementation'] = RequestAgent,
) => {
    const requestId: string = generateRequestId(context, request);
    let parsed: sdk.A2A.A2ARequest;

    if (request?.path?.endsWith('agent-card.json') || request?.path?.endsWith('agent.json')) {
        parsed = {
            jsonrpc: '2.0',
            id: requestId,
            method: 'agentcard/get',
            params: null,
        } as unknown as sdk.A2A.A2ARequest;
    } else {
        parsed = await sdk.validateSchema(sdk.A2A.A2ARequestSchema, request?.body ?? {});
    }

    const params: sdk.A2A.RequestParam = await sdk.validateSchema(sdk.A2A.RequestParamSchema, parsed.params);

    const req: RequestAgentRoute['request'] = {
        method: parsed.method,
        params: params,
    };

    sdk.logger.info(`handle agent request received:${parsed.method}:params:${sdk.formatJson(req)}`);

    const res: RequestAgentRoute['response'] = await implementation(req, context, intercepts);

    sdk.logger.info(`handle agent request completed:${parsed.method}:response:${sdk.formatJson(res)}`);

    await handleJSONRPCResponse(response, requestId, parsed.method, res);
};

export const request: Mount['request'] = async (
    { session, context, handler = handle, user, intercepts },
    implementation: RequestAgentRoute['implementation'] = RequestAgent,
): Promise<void> => {
    const { request, next } = session;

    const agentId: string = Array.isArray(request?.params?.[AGENT_FIELD_NAME])
        ? request?.params?.[AGENT_FIELD_NAME][0]
        : request?.params?.[AGENT_FIELD_NAME];

    if (!agentId) {
        return next(INVALID_REQUEST({ message: `${AGENT_FIELD_NAME} is required` }));
    }

    const _context: RequestAgentRoute['context'] = {
        ...context,
        agentId,
        requestId: generateRequestId(context, request),
        userId: await user?.(session),
    };

    return await handler({ session, context: _context, intercepts }, implementation);
};
