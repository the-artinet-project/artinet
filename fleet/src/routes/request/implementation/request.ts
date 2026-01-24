/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentConfiguration, AgentConfigurationSchema } from 'agent-def';
import * as sdk from '@artinet/sdk';
import { RequestAgentRoute } from '../types/definitions.js';

async function load(context: RequestAgentRoute['context'], target: AgentConfiguration): Promise<sdk.Agent | undefined> {
    /**Check the cache first */
    if (context.agents?.[target.uri]) {
        return context.agents?.[target.uri] as sdk.Agent;
    }

    const agent = (await context.load(target, context)) as sdk.Agent;

    /**Cache the agent for future requests */
    if (agent) {
        context.agents = {
            ...context.agents,
            [target.uri]: agent,
        };
    }
    return agent;
}

export const requestImplementation: RequestAgentRoute['implementation'] = async (request, context) => {
    if (!context.target) {
        throw sdk.INTERNAL_ERROR({
            message: `Agent ${context.agentId} not found: ${sdk.formatJson(
                context.found?.error ?? { error: 'Unknown error' },
            )}`,
            method: request.method,
        });
    }

    const agentConfig: AgentConfiguration = await sdk.validateSchema(AgentConfigurationSchema, context.target);

    const agent: sdk.Agent | undefined = await load(context, agentConfig);

    if (!agent) {
        throw sdk.INTERNAL_ERROR({
            data: {
                message: `Agent ${context.agentId} failed to load`,
            },
        });
    }

    context.agents = {
        ...context.agents,
        [agentConfig.uri]: agent,
    };

    const response = await context.invoke(request, agent, context);
    if (!response) {
        throw sdk.INTERNAL_ERROR({
            data: {
                message: `Agent ${context.agentId} failed to invoke`,
            },
        });
    }

    return response;
};
