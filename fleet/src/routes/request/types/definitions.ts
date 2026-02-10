/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from '@artinet/armada';
import { AgentConfiguration } from 'agent-def';
import * as sdk from '@artinet/sdk';
import { API } from '@artinet/types';
import { z } from 'zod/v4';

import { ResultOrError } from '../../../types.js';

export type AgentRequest = API.APIRequest & {
    method: string;
    params: sdk.A2A.RequestParam;
};

export type AgentError = {
    code: number;
    message: string;
    data?: unknown;
};

export type AgentResponse = API.APIResponse &
    ResultOrError<sdk.A2A.ResponseResult | sdk.A2A.AgentCard, AgentError, sdk.A2A.Update>;

export type Agent = sdk.Agent | sdk.AgentMessenger;

export type loadFunction = (config: AgentConfiguration, context?: RequestContext) => Promise<Agent | undefined>;

export type invokeFunction = <Req extends AgentRequest = AgentRequest>(
    request: Req,
    agent: Agent,
    context?: RequestContext,
) => Promise<AgentResponse | null>;

export interface RequestContext
    extends
        armada.StorageContext<typeof armada.StoredAgentSchema>,
        armada.FindContext<typeof armada.StoredAgentSchema>,
        /**If passing `contexts` to the `orc8` loader, be aware that it requires a Monitored Context Manager */
        Pick<sdk.CreateAgentParams, 'contexts' | 'tasks'> {
    agentId: string;
    headers?: Record<string, string>;
    agents?: Record<string, Agent>;
    target?: AgentConfiguration;
    defaultInstructions?: string;
    /**
     * Normally these functions would be wired in at the entry definition,
     * but allocating them here makes it easier for consumers to override.
     */
    /**
     * This function parses an agent configuration and loads the agent process into memory.
     */
    load: loadFunction;
    /**
     * This function invokes the agent with the given request.
     */
    invoke: invokeFunction;

    /**
     * This function tests the agent with the given request.
     */
    inferenceProviderUrl?: string;
}

export interface RequestAgentRoute<Req extends AgentRequest = AgentRequest> extends armada.Storable<
    typeof armada.StoredAgentSchema,
    Req,
    AgentResponse,
    RequestContext
> {}
export type RequestAgentMount<Session extends object> = armada.Mount<
    Session,
    RequestAgentRoute['request'],
    RequestAgentRoute['response'],
    RequestAgentRoute['context']
>;

export const TestRequestSchema = armada.CreateAgentRequestSchema.extend({
    /**
     * All the requested test tasks
     */
    tests: z.array(sdk.A2A.MessageSendParamsSchema).describe('All the requested test tasks'),
}).describe('The test deployment parameters');
export type TestRequest = z.output<typeof TestRequestSchema> & AgentRequest;

export interface TestAgentRoute extends RequestAgentRoute<TestRequest> {}
export type TestAgentMount<Session extends object> = armada.Mount<
    Session,
    TestAgentRoute['request'],
    TestAgentRoute['response'],
    TestAgentRoute['context']
>;
