/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CreateAgent,
    CreateAgentRoute,
    CreateAgentRequestSchema,
    CreateAgentMount,
} from '../../routes/create/index.js';
import { generateRequestId, generateRegistrationId } from './utils.js';
import { logger, validateSchema, formatJson } from '@artinet/sdk';
import { Session } from './types.js';

export type Mount = CreateAgentMount<Session>;

export const handle: Mount['handler'] = async (
    { session: { request, response }, context, intercepts },
    implementation: CreateAgentRoute['implementation'] = CreateAgent,
): Promise<void> => {
    const req: CreateAgentRoute['request'] = await validateSchema(CreateAgentRequestSchema, request?.body ?? {});

    logger.info(`deploying agent: ${req.config.name}`);
    logger.debug(`deploying agent: ${formatJson(req)}`);

    context.registrationId = generateRegistrationId(req.config.uri);
    const res: CreateAgentRoute['response'] = await implementation(req, context, intercepts);
    response.json(res);
};

export const factory: Mount['factory'] =
    ({ implementation = CreateAgent }: { implementation: CreateAgentRoute['implementation'] }): Mount['handler'] =>
    async (params: {
        session: Session;
        context: CreateAgentRoute['context'];
        intercepts?: CreateAgentRoute['intercept'][];
    }): Promise<void> =>
        await handle(params, implementation);

export const request: Mount['request'] = async (
    { session, context, handler = handle, user, intercepts },
    implementation: CreateAgentRoute['implementation'] = CreateAgent,
): Promise<void> => {
    const _context: CreateAgentRoute['context'] = {
        ...context,
        requestId: generateRequestId(context, session.request),
        userId: await user?.(session),
    };
    return await handler({ session, context: _context, intercepts }, implementation);
};
