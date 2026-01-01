/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { ClientConfig, ScanConfig } from "./types/index.js";
import * as portscanner from "portscanner";
import pLimit from "p-limit";

export const DEFAULT_MAX_THREADS = 250;

export async function scanAgents(config: ScanConfig): Promise<ClientConfig[]> {
  //avoid overwhelming the port scanner
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
    // console.log("No open ports found");
    return [];
  }
  const configs: ClientConfig[] = [];
  for (const port of openPorts) {
    configs.push({
      url: `http://${config.host}:${port}`,
      headers: config.headers,
      fallbackPath: config.fallbackPath,
    });
  }
  return configs;
}
