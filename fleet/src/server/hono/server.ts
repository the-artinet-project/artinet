/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as hono from "hono";
import { serve, type ServerType } from "@hono/node-server";

import * as sdk from "@artinet/sdk";
import { CreateAgentRoute } from "../../routes/create/index.js";
import { Settings as FleetSettings } from "../../settings.js";
import { DEFAULTS } from "../../default.js";

import * as agent from "./agent-request.js";
import * as testing from "./test-request.js";
import * as deployment from "./deploy-request.js";
import { AGENT_FIELD_NAME } from "./agent-request.js";
import { errorHandler } from "./error-handler.js";

export type Settings = FleetSettings & {
  user?: (ctx: hono.Context) => Promise<string>;
  retrieve?: agent.handler;
  deploy?: deployment.handler;
  evaluate?: testing.handler;
  auth?: (ctx: hono.Context, next: hono.Next) => Promise<void>;
};

export interface Options {
  app?: hono.Hono;
  authOnRetrieve?: boolean;
  enableTesting?: boolean;
}

const createContext = (settings: Partial<Settings>) => {
  const _settings = {
    ...DEFAULTS,
    ...settings,
    retrieve: agent.factory(
      settings.get ?? DEFAULTS.get,
      /**Middleware addons are currently only supported on the agent request route */
      settings.middleware?.build() ?? []
    ),
    deploy: deployment.factory(settings.set ?? DEFAULTS.set),
    evaluate: testing.factory(settings.test ?? DEFAULTS.test),
    user: settings.user
      ? settings.user
      : (_ctx: hono.Context) => Promise.resolve(settings.userId ?? "default"),
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
    requestId: undefined,
    timestamp: undefined,
  };
};

export function fleet(
  settings: Partial<Settings> = DEFAULTS,
  {
    app = new hono.Hono(),
    authOnRetrieve = false,
    enableTesting = true,
  }: Options = {}
): {
  app: hono.Hono;
  launch: (port: number) => ServerType;
  ship: (
    agents: CreateAgentRoute["request"][],
    userId?: string
  ) => Promise<{ launch: (port?: number) => ServerType }>;
} {
  const context = createContext(settings);
  const {
    basePath,
    agentPath,
    fallbackPath,
    deploymentPath,
    testPath,
    auth,
    user,
    evaluate,
    deploy,
    retrieve,
    set,
  } = context;

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
        })
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
      })
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
      })
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
      })
  );

  app.route(basePath, router);

  const launch = (port: number = 3000): ServerType => {
    return serve({ fetch: app.fetch, port });
  };

  const ship = async (
    agents: CreateAgentRoute["request"][],
    userId?: string
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
