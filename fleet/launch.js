#!/usr/bin/env node
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (OTEL_ENDPOINT) {
  await import("@opentelemetry/auto-instrumentations-node/register");
}
import { SQLiteStore } from "@artinet/fleet/sqlite";
import { fleet } from "@artinet/fleet/hono";
import { configurePino } from "@artinet/sdk/pino";
import { configure, logger } from "@artinet/sdk";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import pino from "pino";
import pinoCaller from "pino-caller";

const DEFAULT_INSTRUCTIONS =
  process.env.DEFAULT_INSTRUCTIONS || "You are a helpful assistant.";
const INFERENCE_PROVIDER_URL = process.env.INFERENCE_PROVIDER_URL || undefined;
const BASE_PATH = process.env.BASE_PATH || "/";
const DB_PATH = process.env.DB_PATH || "fleet.db";
const PORT = process.env.PORT || 3000;
const USER = process.env.USER || "default";

const LOG_LEVEL = process.env.LOG_LEVEL || "warn";
const baseLogger = configurePino(
  pinoCaller(
    pino({
      level: LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    })
  )
);

if (OTEL_ENDPOINT) {
  const { configureOtel } = await import("@artinet/sdk/otel");
  configure({
    logger: configureOtel({ baseLogger, level: LOG_LEVEL }),
  });
  logger.info(`OTel enabled → ${OTEL_ENDPOINT}`);
} else {
  configure({ logger: baseLogger });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  logger.warn("Warning: OPENAI_API_KEY not set. LLM features will fail.");
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing database...");
  sqlite.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, closing database...");
  sqlite.close();
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

try {
  fleet({
    storage: new SQLiteStore(db),
    user: async () => USER,
    defaultInstructions: DEFAULT_INSTRUCTIONS,
    inferenceProviderUrl: INFERENCE_PROVIDER_URL,
    basePath: BASE_PATH,
  }).launch(PORT);
  logger.info(`Fleet running on port ${PORT}`);
} catch (error) {
  logger.error("Failed to start fleet:", error);
  sqlite.close();
  process.exit(1);
}
