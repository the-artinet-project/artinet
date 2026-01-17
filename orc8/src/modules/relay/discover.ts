/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Discovery utilities for scanning network ports and maintaining a live agent registry.
 *
 * @module orc8/relay/discover
 *
 * @remarks
 * Use this module for automatic port-based agent discovery with optional
 * periodic synchronization. For manual registration without scanning,
 * see {@link Relay} in `./relay.ts`.
 *
 * @see {@link ./relay.ts} - Base relay without discovery
 */
import * as sdk from "@artinet/sdk";
import * as portscanner from "portscanner";
import pLimit from "p-limit";
import * as Relay from "./relay.js";

/** Default maximum concurrent port scan threads. */
export const DEFAULT_MAX_THREADS = 250;

/**
 * Configuration for network port scanning.
 *
 * @see {@link Discover.scan} - Low-level port scanner
 * @see {@link DiscoverableRelay.discoverAgents} - High-level discovery method
 */
export interface ScanConfig
  extends Pick<sdk.MessengerParams, "headers" | "fallbackPath"> {
  /** Target hostname to scan. */
  host: string;
  /** First port in the scan range (inclusive). */
  startPort: number;
  /** Last port in the scan range (inclusive). */
  endPort: number;
  /** Concurrent scan threads. Defaults to {@link DEFAULT_MAX_THREADS}. */
  threads?: number;
}

/**
 * Scans a port range for open ports and returns messenger configs.
 *
 * @param config - {@link ScanConfig} Scan configuration
 * @returns Array of {@link sdk.MessengerParams} for open ports
 *
 * @internal
 */
async function _scanAgents(config: ScanConfig): Promise<sdk.MessengerParams[]> {
  const limit = pLimit(config.threads ?? DEFAULT_MAX_THREADS);
  const portChecks = [];
  for (let port: number = config.startPort; port <= config.endPort; port++) {
    portChecks.push(
      limit(
        async () =>
          await portscanner
            .checkPortStatus(port, config.host)
            .then((status) => ({ port, status }))
      )
    );
  }

  const results = await Promise.all(portChecks);

  const openPorts: number[] = results
    .filter((r) => r.status === "open")
    .map((r) => r.port);

  if (!openPorts?.length) {
    sdk.logger.info("No open ports found");
    return [];
  }

  const configs: sdk.MessengerParams[] = [];

  for (const port of openPorts) {
    configs.push({
      baseUrl: `http://${config.host}:${port}`,
      headers: config.headers,
      fallbackPath: config.fallbackPath,
    });
  }

  return configs;
}

/**
 * Discovers agents by scanning ports and updating the relay registry.
 *
 * Registers newly found agents and removes unreachable ones.
 *
 * @param relay - {@link Relay.Relay} Relay instance to update
 * @param config - {@link ScanConfig} Scan configuration
 * @returns Array of {@link sdk.A2A.AgentCard} discovered agent cards
 *
 * @remarks
 * - Registration errors are logged but do not halt the scan
 * - Agents missing from the scan are automatically deregistered
 *
 * @internal
 */
async function _discoverAgents(
  relay: Relay.Relay,
  config: ScanConfig
): Promise<sdk.A2A.AgentCard[]> {
  const configs = await _scanAgents(config).catch((error) => {
    sdk.logger.error("Error scanning agents", error);
    return [];
  });

  let liveAgents: string[] = [];
  let detectedAgents: sdk.A2A.AgentCard[] = [];

  for (const config of configs) {
    const agentCard = await relay.registerAgent(config).catch((error) => {
      sdk.logger.warn("Error registering agent", {
        baseUrl: config.baseUrl,
        error,
      });
      return undefined;
    });

    if (agentCard) {
      liveAgents.push(agentCard.name);
      detectedAgents.push(agentCard);
    }
  }

  const currentAgents = relay.uris;
  const agentsToRemove = currentAgents.filter(
    (agentId: string) => !liveAgents.includes(agentId)
  );

  for (const agentId of agentsToRemove) {
    await relay.deregisterAgent(agentId);
  }

  return detectedAgents;
}

/**
 * Default sync interval in milliseconds.
 *
 * @remarks
 * Can be overridden via the `ARTINET_RELAY_SYNC_INTERVAL` environment variable.
 */
export const DEFAULT_SYNC_INTERVAL = parseInt(
  process.env.ARTINET_RELAY_SYNC_INTERVAL || "30000"
);

/**
 * Extended configuration adding scan and sync options to the base relay config.
 *
 * @see {@link DiscoverableRelay.create}
 */
export type Extended = ScanConfig & {
  /**
   * Interval (ms) between automatic rescans.
   * Omit to disable background sync.
   */
  syncInterval?: number;
};

/** Full discoverable relay configuration. */
export type Config = Relay.Config & Extended;

/** Configuration params with optional scan settings (defaults applied at runtime). */
export type ConfigParams = Relay.Config & Partial<Extended>;

/**
 * Relay with automatic port-based agent discovery.
 *
 * Extends {@link Relay} to scan network ports, register discovered agents,
 * and optionally keep the registry synchronized via periodic rescans.
 *
 * @extends Relay
 *
 * @see {@link Relay} - Base relay without discovery
 * @see {@link Discover.create} - Factory function alias
 *
 * @example
 * ```typescript
 * import { Discover } from "orc8/relay";
 *
 * const relay = await Discover.create({
 *   callerId: "orchestrator",
 *   host: "localhost",
 *   startPort: 3000,
 *   endPort: 3100,
 *   syncInterval: 5000
 * });
 *
 * const agents = await relay.searchAgents({ query: "weather" });
 *
 * await relay.stop();
 * ```
 */
export class DiscoverableRelay extends Relay.Relay {
  private timeoutId: NodeJS.Timeout | null = null;

  /**
   * Constructs a DiscoverableRelay instance.
   *
   * @param _extendedConfig - Full configuration including scan settings
   *
   * @remarks
   * Prefer {@link DiscoverableRelay.create} for proper initialization.
   */
  constructor(private readonly _extendedConfig: Config) {
    super(_extendedConfig);
  }

  /**
   * Starts background synchronization at the configured interval.
   *
   * @throws {Error} If `syncInterval` is not configured
   *
   * @remarks
   * Called automatically by {@link DiscoverableRelay.create} when `syncInterval` is set.
   *
   * @internal
   */
  private async startSync(): Promise<void> {
    if (!this._extendedConfig.syncInterval) {
      throw new Error("Sync interval is not configured");
    }
    if (this.timeoutId) {
      clearInterval(this.timeoutId);
    }
    this.timeoutId = setInterval(async () => {
      await this.discoverAgents();
    }, this._extendedConfig.syncInterval);
  }

  /**
   * Scans for agents and updates the registry.
   *
   * Registers newly discovered agents and removes unreachable ones.
   *
   * @param config - Optional override for {@link ScanConfig} scan configuration
   * @returns Array of {@link sdk.A2A.AgentCard} discovered agent cards
   *
   * @remarks
   * - Errors during registration are logged but do not halt the scan
   * - Previously registered agents not found in the scan are deregistered
   *
   * @see {@link Relay.registerAgent} - Manual registration
   *
   * @example
   * ```typescript
   * const agents = await relay.discoverAgents();
   * console.log(`Found ${agents.length} agents`);
   * ```
   */
  public async discoverAgents(
    config?: ScanConfig
  ): Promise<sdk.A2A.AgentCard[]> {
    return await _discoverAgents(this, config ?? this._extendedConfig);
  }

  /**
   * Stops background sync and releases resources.
   *
   * @returns Resolves when cleanup completes
   *
   * @example
   * ```typescript
   * await relay.stop();
   * ```
   */
  async stop(): Promise<void> {
    if (this.timeoutId) {
      clearInterval(this.timeoutId);
    }
    await super.stop();
  }

  /**
   * Stops background sync and releases resources.
   *
   * @returns Resolves when cleanup completes
   *
   * @deprecated Use {@link DiscoverableRelay.stop} instead.
   */
  async close(): Promise<void> {
    await this.stop();
  }

  /**
   * Creates and initializes a DiscoverableRelay instance.
   *
   * Performs an initial scan and starts background sync if configured.
   *
   * @param config - {@link Config} Relay and scan configuration
   * @returns Initialized {@link DiscoverableRelay} instance
   *
   * @example
   * ```typescript
   * const relay = await DiscoverableRelay.create({
   *   callerId: "my-agent",
   *   host: "localhost",
   *   startPort: 3000,
   *   endPort: 3100,
   *   syncInterval: 2500
   * });
   * ```
   */
  static async create(config: ConfigParams): Promise<DiscoverableRelay> {
    const extendedConfig = {
      ...config,
      host: config.host ?? "localhost",
      startPort: config.startPort ?? 3000,
      endPort: config.endPort ?? 3100,
      threads: config.threads ?? DEFAULT_MAX_THREADS,
    };
    const relay = new DiscoverableRelay(extendedConfig);
    await relay.discoverAgents();
    if (extendedConfig.syncInterval) {
      await relay.startSync();
    }
    return relay;
  }
}

/**
 * Discovery utilities namespace.
 *
 * @example
 * ```typescript
 * import { Discover } from "orc8/relay";
 *
 * // Create a discoverable relay
 * const relay = await Discover.create({ callerId: "my-agent" });
 *
 * // Low-level port scan
 * const configs = await Discover.scan({ host: "localhost", startPort: 3000, endPort: 3100 });
 * ```
 */
export const Discover = {
  /** Scans ports and returns messenger configurations for open ports. */
  scan: _scanAgents,
  /** Discovers agents on a relay instance. */
  agents: _discoverAgents,
  /** Creates a discoverable relay instance. Alias for {@link DiscoverableRelay.create}. */
  create: DiscoverableRelay.create,
};
