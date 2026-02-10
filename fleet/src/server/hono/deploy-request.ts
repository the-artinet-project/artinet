/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sdk from '@artinet/sdk';
import {
    CreateAgent,
    CreateAgentMount,
    CreateAgentRoute,
    CreateAgentRequestSchema,
} from '../../routes/create/index.js';
import { generateRequestId, generateRegistrationId } from './utils.js';
import { Session } from './types.js';

export type Mount = CreateAgentMount<Session>;

export const factory: Mount['factory'] =
    ({ implementation = CreateAgent }: { implementation: CreateAgentRoute['implementation'] }): Mount['handler'] =>
    async (params): Promise<void> =>
        await handle(params, implementation);

export const handle: Mount['handler'] = async (
    { session: { ctx }, context, intercepts },
    implementation: CreateAgentRoute['implementation'] = CreateAgent,
): Promise<void> => {
    /* hono.Context.req uses a raw JSON.parse() so we prefer to use the text() and our own safeParse() */
    const req = sdk.safeParse(await ctx.req.text());
    const request: CreateAgentRoute['request'] = await sdk.validateSchema(CreateAgentRequestSchema, req);

    sdk.logger.info(`deploying agent: ${request.config.name}`);
    sdk.logger.debug(`deploying agent: ${sdk.formatJson(request)}`);

    context.registrationId = generateRegistrationId(request.config.uri);
    const result: CreateAgentRoute['response'] = await implementation(request, context, intercepts);
    ctx.res = ctx.json(result);
};

export const request: Mount['request'] = async (
    { session, context, handler = handle, user, intercepts },
    implementation: CreateAgentRoute['implementation'] = CreateAgent,
): Promise<void> => {
    const { ctx } = session;
    const reqId = ctx.req.header('x-request-id') ?? sdk.safeParse(await ctx.req.text())?.id;
    const _context: CreateAgentRoute['context'] = {
        ...context,
        requestId: generateRequestId(context, reqId),
        userId: await user?.(session),
    };
    await handler({ session, context: _context, intercepts }, implementation);
};
