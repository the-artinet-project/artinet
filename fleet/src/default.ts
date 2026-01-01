import * as armada from "@artinet/armada";
import {
  RequestAgent,
  CreateAgent,
  TestAgent,
  loadAgent,
  invokeAgent,
} from "./routes/index.js";
import { InMemoryStore } from "./storage/in-memory.js";

export const DEFAULTS = {
  basePath: "/",
  agentPath: armada.RETRIEVE_DEPLOYMENT_PATH,
  fallbackPath: armada.RETRIEVE_FALLBACK_PATH,
  deploymentPath: armada.CREATE_DEPLOYMENT_PATH,
  testPath: armada.TEST_DEPLOYMENT_PATH,
  get: RequestAgent,
  set: CreateAgent,
  test: TestAgent,
  load: loadAgent,
  invoke: invokeAgent,
  storage: new InMemoryStore(),
  baseUrl: "https://localhost:3000",
};
