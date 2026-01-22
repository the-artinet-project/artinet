#!/usr/bin/env node

/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { mkdirSync, writeFileSync } from "fs";
import { AgentConfigurationSchema } from "../src/definition";
import { z } from "zod/v4";
import path from "path";


const jsonSchema = z.toJSONSchema(AgentConfigurationSchema, { 
  /** Don't love this */
  unrepresentable: "any"
});
jsonSchema.title = "AgentConfiguration";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.join(__dirname, "../src/generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, "agent-configuration.schema.json"),
  JSON.stringify(jsonSchema, null, 2)
);
console.log(`Generated JSON Schema written to ${outDir}`);
