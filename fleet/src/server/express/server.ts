import { errorHandler as rpcErrorHandler } from "@artinet/sdk";
import express from "express";
import * as agent from "./agent-request.js";
import * as testing from "./test-request.js";
import * as deployment from "./deploy-request.js";
import { Settings as FleetSettings } from "../../settings.js";
import { DEFAULTS } from "../../default.js";
import { AGENT_FIELD_NAME } from "./agent-request.js";

export type Settings = FleetSettings & {
  user?: (req: express.Request) => Promise<string>;
  retrieve?: agent.handler;
  deploy?: deployment.handler;
  evaluate?: testing.handler;
  auth?: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => Promise<void>;
};

export interface Options {
  app?: express.Application;
  authOnRetrieve?: boolean;
  enableTesting?: boolean;
}

const createContext = (settings: Partial<Settings>) => {
  const _settings = {
    ...DEFAULTS,
    ...settings,
    retrieve: agent.factory(settings.get ?? DEFAULTS.get),
    deploy: deployment.factory(settings.set ?? DEFAULTS.set),
    evaluate: testing.factory(settings.test ?? DEFAULTS.test),
    user: settings.user
      ? settings.user
      : (_req: express.Request) =>
          Promise.resolve(settings.userId ?? "default"),
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
    agents: undefined,
    requestId: undefined,
    timestamp: undefined,
  };
};

export function fleet(
  settings: Partial<Settings> = DEFAULTS,
  {
    app = express(),
    authOnRetrieve = false,
    enableTesting = true,
  }: Options = {}
): express.Application {
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
  } = context;

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
      async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) =>
        await testing.request({
          request: req,
          response: res,
          next,
          context: createRequestContext(context),
          handler: evaluate,
          user,
        }),
      rpcErrorHandler
    );
  }

  router.post(
    deploymentPath,
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) =>
      await deployment.request({
        request: req,
        response: res,
        next,
        context: createRequestContext(context),
        handler: deploy,
        user,
      })
  );
  router.use(
    `${agentPath}/:${AGENT_FIELD_NAME}`,
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) =>
      await agent.request({
        request: req,
        response: res,
        next,
        context: createRequestContext(context),
        handler: retrieve,
        user,
      }),
    rpcErrorHandler
  );

  router.use(
    `${fallbackPath}/:${AGENT_FIELD_NAME}`,
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) =>
      await agent.request({
        request: req,
        response: res,
        next,
        context: createRequestContext(context),
        handler: retrieve,
        user,
      }),
    rpcErrorHandler
  );

  app.use(basePath, router);
  return app;
}
