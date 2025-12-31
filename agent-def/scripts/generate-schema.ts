#!/usr/bin/env node

/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { mkdirSync, writeFileSync } from "fs";
import { AgentDefinitionSchema } from "../src/definition";
import { zodToJsonSchema } from "zod-to-json-schema";

const jsonSchema = zodToJsonSchema(AgentDefinitionSchema, "AgentDefinition");
import path from "path";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.join(__dirname, "../src/generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, "agent-definition.schema.json"),
  JSON.stringify(jsonSchema, null, 2)
);
console.log(`Generated JSON Schema written to ${outDir}`);
