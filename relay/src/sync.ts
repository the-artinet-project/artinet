/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  AgentRuntimeSchema,
  IRuntimeSync,
  SyncConfig,
  RuntimeServerConfig,
} from "./types/index.js";
import { join } from "path";
import { homedir } from "os";
import { AgentRuntime } from "./types/config.js";
import fs from "fs/promises";
import { dirname } from "path";

export const DEFAULT_RELAY_CONFIG_PATH =
  process.env.ARTINET_RELAY_CONFIG_DIR ||
  (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "symphony")
    : join(homedir(), ".config", "symphony"));

export function getAgentRuntimePath(
  configPath: string = DEFAULT_RELAY_CONFIG_PATH
): string {
  return join(configPath, "agent-runtime.json");
}

export class RuntimeLoader {
  private configPath: string;
  constructor(configPath: string = DEFAULT_RELAY_CONFIG_PATH) {
    this.configPath = configPath;
  }
  async loadAgentRuntime(): Promise<AgentRuntime> {
    const runtimeFilePath = getAgentRuntimePath(this.configPath);

    const dir = dirname(runtimeFilePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    try {
      await fs.access(runtimeFilePath);
    } catch {
      await fs.writeFile(runtimeFilePath, "{}", "utf8");
    }

    try {
      await fs.access(runtimeFilePath);
    } catch {
      throw new Error(
        `agent runtime file does not exist or is not accessible: ${runtimeFilePath}`
      );
    }

    const agentRuntime = await fs.readFile(runtimeFilePath, "utf8");
    if (agentRuntime.trim() === "") {
      throw new Error("agent runtime file is empty");
    }

    const parsedRuntime = AgentRuntimeSchema.safeParse(
      JSON.parse(agentRuntime)
    );
    if (parsedRuntime.error) {
      throw new Error(
        "invalid agent runtime file: " + parsedRuntime.error.message
      );
    }
    // filter out removed agents
    // we do this here so that all runtimes know not to add the removed agent to their runtime
    const runtime = Object.fromEntries(
      Object.entries(parsedRuntime.data).filter(
        ([_, value]: [string, RuntimeServerConfig]) =>
          value.removed === undefined ? true : value.removed !== true
      )
    );
    return runtime;
  }

  async saveAgentRuntime(agentRuntime: AgentRuntime): Promise<void> {
    const runtimeFilePath = getAgentRuntimePath(this.configPath);
    const currentRuntime = await this.loadAgentRuntime();
    const newRuntime = { ...currentRuntime, ...agentRuntime };
    await fs.writeFile(
      runtimeFilePath,
      JSON.stringify(newRuntime, null, 2),
      "utf8"
    );
  }
}

export class Sync extends RuntimeLoader implements IRuntimeSync {
  private syncInterval: number;
  private runtime: AgentRuntime = {};
  private abortSignal: AbortSignal;
  private _isRunning: boolean = false;
  constructor(config: SyncConfig) {
    super(config.configPath);
    this.syncInterval = config.syncInterval;
    this.abortSignal = config.abortSignal;
    this.initializeSync().catch((error) => {
      console.error("Error syncing runtime: ", error);
    });
  }
  private async initializeSync(): Promise<void> {
    this._isRunning = true;
    while (!this.abortSignal.aborted && this._isRunning) {
      this.runtime = await this.loadAgentRuntime();
      await new Promise((resolve) => setTimeout(resolve, this.syncInterval));
    }
  }
  async getRuntime(): Promise<AgentRuntime> {
    this.runtime = await this.loadAgentRuntime();
    return this.runtime;
  }
  async updateRuntime(data: AgentRuntime): Promise<boolean> {
    this.runtime = { ...this.runtime, ...data };
    await this.saveAgentRuntime(this.runtime);
    return true;
  }
  isRunning(): boolean {
    return this._isRunning;
  }
  close(): void {
    this._isRunning = false;
  }
}
