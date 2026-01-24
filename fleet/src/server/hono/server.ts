/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as hono from 'hono';
import { serve, type ServerType } from '@hono/node-server';

import * as sdk from '@artinet/sdk';
import { CreateAgentRoute } from '../../routes/create/index.js';
import { Settings as FleetSettings } from '../../settings.js';
import { DEFAULTS } from '../../default.js';

import * as agent from './agent-request.js';
import * as testing from './test-request.js';
import * as deployment from './deploy-request.js';
import { AGENT_FIELD_NAME } from './agent-request.js';
import { errorHandler } from './error-handler.js';
import {
    WebStandardStreamableHTTPServerTransport,
    WebStandardStreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { mountMCP } from '../mcp/index.js';
import { handleMCP } from './mcp.js';
/**
 * Extended settings for the Hono Fleet server.
 *
 * Combines base {@link FleetSettings} with Hono-specific handlers for
 * authentication, user resolution, and request processing.
 *
 * @see {@link https://hono.dev/docs/guides/middleware Hono Middleware Guide}
 */
export type Settings = FleetSettings & {
    /** Extracts the user ID from the Hono context. Used for multi-tenant agent isolation. */
    user?: (ctx: hono.Context) => Promise<string>;
    /** Handler for agent retrieval requests. Generated via {@link agent.factory}. */
    retrieve?: agent.handler;
    /** Handler for agent deployment requests. Generated via {@link deployment.factory}. */
    deploy?: deployment.handler;
    /** Handler for agent test/evaluation requests. Generated via {@link testing.factory}. */
    evaluate?: testing.handler;
    /**
     * Authentication middleware applied to protected routes.
     * @see {@link https://hono.dev/docs/guides/middleware#middleware-argument Middleware Guide}
     */
    auth?: (ctx: hono.Context, next: hono.Next) => Promise<void>;

    /** MCP transport options. Defaults to `undefined`. */
    mcp?: {
        path?: string;
        options: WebStandardStreamableHTTPServerTransportOptions;
        getTransport?: (ctx: hono.Context) => Promise<WebStandardStreamableHTTPServerTransport>;
    };
};

/**
 * Options for configuring the Fleet server instance.
 *
 * Allows injection of a pre-configured Hono app for integration with
 * existing servers or edge runtime deployments.
 */
export interface Options {
    /** Pre-configured Hono application. Defaults to a new `Hono()` instance. */
    app?: hono.Hono;
    /** Apply auth middleware to agent retrieval routes. Defaults to `false`. */
    authOnRetrieve?: boolean;
    /** Expose the test endpoint for agent evaluation. Defaults to `true`. */
    enableTesting?: boolean;
}

const createContext = (settings: Partial<Settings>) => {
    const _settings = {
        ...DEFAULTS,
        ...settings,
        retrieve: agent.factory(
            settings.get ?? DEFAULTS.get,
            /**Middleware addons are currently only supported on the agent request route */
            settings.middleware?.build() ?? [],
        ),
        deploy: deployment.factory(settings.set ?? DEFAULTS.set),
        evaluate: testing.factory(settings.test ?? DEFAULTS.test),
        user: settings.user ? settings.user : (_ctx: hono.Context) => Promise.resolve(settings.userId ?? 'default'),
    };
    return _settings;
};

const createRequestContext = (context: Settings) => {
    //clear session data between requests
    return {
        ...context,
        headers: undefined,
        userId: undefined,
        found: undefined,
        target: undefined,
        defaultInstructions: undefined,
        agentId: undefined,
        /**cache agents in memory so we don't have to load them from storage on every request */
        // agents: undefined,
        metadata: undefined,
        requestId: undefined,
        timestamp: undefined,
    };
};

/**
 * Creates and configures a Fleet server instance using Hono.
 *
 * This function implements the **Factory Pattern** combined with **Dependency Injection**
 * to provide a flexible, testable, and configurable server setup. Hono is chosen for its
 * ultrafast performance, edge-runtime compatibility, and minimal footprint.
 *
 * @see {@link https://hono.dev/docs/ Hono Documentation}
 * @see {@link https://hono.dev/docs/concepts/routers Hono Routers}
 * @see {@link https://hono.dev/docs/guides/middleware Hono Middleware Guide}
 *
 * ## Security Considerations
 *
 * - Authentication middleware is applied conditionally via `auth` setting
 * - `authOnRetrieve` flag controls whether agent retrieval requires authentication
 * - Consider enabling `authOnRetrieve` in production environments
 *
 * @param settings - Partial configuration merged with defaults. Supports custom
 *   handlers for `get`, `set`, `test`, and middleware composition.
 * @param options - Server instantiation options
 * @param options.app - Pre-configured Hono application instance. Useful for
 *   adding custom middleware or integrating with existing servers.
 * @param options.authOnRetrieve - When `true`, applies auth middleware to agent
 *   retrieval routes. Defaults to `false` for development convenience.
 * @param options.enableTesting - When `true`, exposes the test endpoint for
 *   agent evaluation. Disable in production if not needed.
 *
 * @returns Object containing:
 *   - `app`: The configured Hono application
 *   - `launch`: Function to start the HTTP server on a specified port
 *   - `ship`: Async function to deploy agents and return a launchable server
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const { app, launch } = fleet();
 * launch(3000);
 *
 * // With custom configuration and edge deployment
 * const { app } = fleet({ userId: 'admin' }, { authOnRetrieve: true });
 * export default app; // For Cloudflare Workers
 * ```
 */
export function fleet(
    settings: Partial<Settings> = DEFAULTS,
    { app = new hono.Hono(), authOnRetrieve = false, enableTesting = true }: Options = {},
): {
    app: hono.Hono;
    launch: (port: number) => ServerType;
    ship: (
        agents: CreateAgentRoute['request'][],
        userId?: string,
    ) => Promise<{ launch: (port?: number) => ServerType }>;
} {
    const context = createContext(settings);
    const { basePath, agentPath, fallbackPath, deploymentPath, testPath, auth, user, evaluate, deploy, retrieve, set } =
        context;

    const router = new hono.Hono();
    // router.use(hono.json());
    router.onError(errorHandler);
    if (auth) {
        router.use(testPath, auth);
        router.use(deploymentPath, auth);
        if (authOnRetrieve) {
            router.use(agentPath, auth);
            router.use(fallbackPath, auth);
        }
    }

    if (enableTesting === true && evaluate !== undefined) {
        router.post(
            testPath,
            async (ctx: hono.Context, next: hono.Next) =>
                await testing.request({
                    ctx,
                    next,
                    context: createRequestContext(context),
                    handler: evaluate,
                    user,
                }),
        );
    }

    router.post(
        deploymentPath,
        async (ctx: hono.Context, next: hono.Next) =>
            await deployment.request({
                ctx,
                next,
                context: createRequestContext(context),
                handler: deploy,
                user,
            }),
    );

    router.use(
        `${agentPath}/:${AGENT_FIELD_NAME}/*`,
        async (ctx: hono.Context, next: hono.Next) =>
            await agent.request({
                ctx,
                next,
                context: createRequestContext(context),
                handler: retrieve,
                user,
            }),
    );

    router.use(
        `${fallbackPath}/:${AGENT_FIELD_NAME}/*`,
        async (ctx: hono.Context, next: hono.Next) =>
            await agent.request({
                ctx,
                next,
                context: createRequestContext(context),
                handler: retrieve,
                user,
            }),
    );

    if (context.mcp) {
        const mountedMCP = mountMCP(context);
        router.all(context.mcp?.path ?? `/mcp`, async (ctx: hono.Context, _) => {
            const relay = await mountedMCP;
            const getTransport =
                context.mcp?.getTransport ??
                (() => Promise.resolve(new WebStandardStreamableHTTPServerTransport(context.mcp?.options ?? {})));
            return await handleMCP(relay, ctx, getTransport);
        });
    }

    app.route(basePath, router);

    const launch = (port: number = 3000): ServerType => {
        return serve({ fetch: app.fetch, port });
    };

    const ship = async (
        agents: CreateAgentRoute['request'][],
        userId?: string,
    ): Promise<{ launch: (port?: number) => ServerType }> => {
        for (const agent of agents) {
            const response = await set(agent, {
                ...createRequestContext(context),
                userId: userId ?? (await user?.({} as any)),
            });
            if (response.success) {
                sdk.logger.info(`Agent shipped: ${response.agentId}`);
            }
        }
        return { launch };
    };

    return { app, launch, ship };
}

// const swarm = await fleet().ship([
//   {
//     config: {
//       uri: "my-agent",
//       name: "my-agent",
//       description: "A helpful assistant",
//       modelId: "gpt-4",
//       instructions: "You are a helpful assistant.",
//       version: "1.0.0",
//       skills: [],
//       capabilities: {},
//       services: [],
//     },
//   },
// ]);
// swarm.launch(3000);
