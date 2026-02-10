/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from 'http';
import * as sdk from '@artinet/sdk';
import express from 'express';

import { CreateAgentRoute } from '../../routes/create/index.js';
import { Settings as FleetSettings } from '../../settings.js';
import { DEFAULTS } from '../../default.js';

import * as agent from './agent-request.js';
import * as testing from './test-request.js';
import * as deployment from './deploy-request.js';
import { AGENT_FIELD_NAME } from '../../default.js';
import { Session } from './types.js';

/**
 * Extended settings for the Express Fleet server.
 *
 * Combines base {@link FleetSettings} with Express-specific handlers for
 * authentication, user resolution, and request processing.
 *
 * @see {@link https://expressjs.com/en/guide/using-middleware.html Express Middleware}
 */
export type Settings = FleetSettings & {
    /** Extracts the user ID from an incoming request. Used for multi-tenant agent isolation. */
    user?: (session: Session) => Promise<string>;

    /** Handler for agent retrieval requests. Generated via {@link agent.factory}. */
    retrieve?: agent.Mount['handler'];

    /** Handler for agent deployment requests. Generated via {@link deployment.factory}. */
    deploy?: deployment.Mount['handler'];

    /** Handler for agent test/evaluation requests. Generated via {@link testing.factory}. */
    evaluate?: testing.Mount['handler'];

    /**
     * Authentication middleware applied to protected routes.
     * @see {@link https://expressjs.com/en/guide/writing-middleware.html Writing Middleware}
     */
    auth?: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>;
};

/**
 * Options for configuring the Fleet server instance.
 *
 * Allows injection of a pre-configured Express app for integration with
 * existing servers or custom middleware stacks.
 */
export interface Options {
    /** Pre-configured Express application. Defaults to a new `express()` instance. */
    app?: express.Application;
    /** Apply auth middleware to agent retrieval routes. Defaults to `false`. */
    authOnRetrieve?: boolean;
    /** Expose the test endpoint for agent evaluation. Defaults to `true`. */
    enableTesting?: boolean;
}

const createContext = (settings: Partial<Settings>) => {
    const _settings = {
        ...DEFAULTS,
        ...settings,
        retrieve: agent.factory({ implementation: settings.get ?? DEFAULTS.get }),
        deploy: deployment.factory({ implementation: settings.set ?? DEFAULTS.set }),
        evaluate: testing.factory({ implementation: settings.test ?? DEFAULTS.test }),
        user: settings.user ? settings.user : (_session: Session) => Promise.resolve(settings.userId ?? 'default'),
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
        /**cache agents in memory so we don't have to load them from storage on every request */
        // agents: undefined,
        agentId: undefined,
        requestId: undefined,
        timestamp: undefined,
    };
};

/**
 * Creates and configures a Fleet server instance using Express.
 *
 * This function implements the **Factory Pattern** combined with **Dependency Injection**
 * to provide a flexible, testable, and configurable server setup. The pattern allows
 * consumers to override defaults while maintaining sensible out-of-the-box behavior.
 *
 * @param settings - Partial configuration merged with defaults. Supports custom
 *   handlers for `get`, `set`, `test`, and middleware composition.
 * @param options - Server instantiation options
 * @param options.app - Pre-configured Express application instance. Useful for
 *   adding custom middleware or integrating with existing servers.
 * @param options.authOnRetrieve - When `true`, applies auth middleware to agent
 *   retrieval routes. Defaults to `false` for development convenience.
 * @param options.enableTesting - When `true`, exposes the test endpoint for
 *   agent evaluation. Disable in production if not needed.
 *
 * @returns Object containing:
 *   - `app`: The configured Express application
 *   - `launch`: Function to start the HTTP server on a specified port
 *   - `ship`: Async function to deploy agents and return a launchable server
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const { app, launch } = fleet();
 * launch(3000);
 *
 * // With custom configuration
 * const { ship } = fleet({ userId: 'admin' }, { authOnRetrieve: true });
 * const server = await ship([agentConfig]);
 * server.launch(8080);
 * ```
 */
export function fleet(
    settings: Partial<Settings> = DEFAULTS,
    { app = express(), authOnRetrieve = false, enableTesting = true }: Options = {},
): {
    app: express.Application;
    launch: (port: number) => Server;
    ship: (agents: CreateAgentRoute['request'][], userId?: string) => Promise<{ launch: (port?: number) => Server }>;
} {
    const context = createContext(settings);
    const { basePath, agentPath, fallbackPath, deploymentPath, testPath, auth, user, evaluate, deploy, retrieve, set } =
        context;

    const router = express.Router();
    router.use(express.json());

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
            async (request: express.Request, response: express.Response, next: express.NextFunction) =>
                await testing.request({
                    session: { request, response, next },
                    context: createRequestContext(context),
                    handler: evaluate,
                    user,
                }),
            sdk.errorHandler,
        );
    }

    router.post(
        deploymentPath,
        async (request: express.Request, response: express.Response, next: express.NextFunction) =>
            await deployment.request({
                session: { request, response, next },
                context: createRequestContext(context),
                handler: deploy,
                user,
            }),
    );

    router.use(
        `${agentPath}/:${AGENT_FIELD_NAME}`,
        async (request: express.Request, response: express.Response, next: express.NextFunction) =>
            await agent.request({
                session: { request, response, next },
                context: createRequestContext(context),
                handler: retrieve,
                user,
                intercepts: settings.middleware?.build() ?? [],
            }),
        sdk.errorHandler,
    );

    router.use(
        `${fallbackPath}/:${AGENT_FIELD_NAME}`,
        async (request: express.Request, response: express.Response, next: express.NextFunction) =>
            await agent.request({
                session: { request, response, next },
                context: createRequestContext(context),
                handler: retrieve,
                user,
                intercepts: settings.middleware?.build() ?? [],
            }),
        sdk.errorHandler,
    );

    app.use(basePath, router);

    const launch = (port: number = 3000): Server => {
        return app.listen(port, () => {
            sdk.logger.info(`Fleet server running on http://localhost:${port}`);
        });
    };

    const ship = async (
        agents: CreateAgentRoute['request'][],
        userId?: string,
    ): Promise<{ launch: (port?: number) => Server }> => {
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
