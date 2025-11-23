/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentConfiguration } from "agent-def";

export interface ResolvedAgent {
  sourceFile: string;
  config: AgentConfiguration;
  client?: boolean;
}

export interface LoadError {
  filePath: string;
  errors: any[];
}

export interface LoadResults {
  agents: Record<string, ResolvedAgent>;
  errors: LoadError[];
}

export interface AgentLoaderConfig {
  threads: number;
  availableTools: string[];
  fileExtensions: string[];
}
