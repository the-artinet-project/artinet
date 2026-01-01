/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import { AgentType } from "./manager.js";
import { z } from "zod/v4";

export const RuntimeServerConfigSchema = Runtime.ServerConfigSchema.extend({
  removed: z.boolean().optional(),
});
export type RuntimeServerConfig = z.infer<typeof RuntimeServerConfigSchema>;
export const AgentRuntimeSchema = z.record(
  z.string(),
  RuntimeServerConfigSchema
);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export interface IRuntimeSync {
  getRuntime(): Promise<AgentRuntime>;
  updateRuntime(data: AgentRuntime): Promise<boolean>;
}

export interface RuntimeLoaderConfig {
  configPath: string;
}

export interface SyncConfig extends Partial<RuntimeLoaderConfig> {
  abortSignal: AbortSignal;
  syncInterval: number;
}

export const ScanConfigSchema = z.object({
  host: z.string(),
  startPort: z.number(),
  endPort: z.number(),
  headers: z.record(z.string(), z.string()).optional(),
  fallbackPath: z.string().optional(),
  threads: z.number().optional(),
});
export type ScanConfig = z.infer<typeof ScanConfigSchema>;

export interface AgentRelayConfig extends Partial<SyncConfig> {
  callerId: string;
  scanConfig?: ScanConfig;
  agents?: Map<string, AgentType>;
}
