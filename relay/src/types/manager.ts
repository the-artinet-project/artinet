/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Agent, A2AClient } from "@artinet/sdk";

export type AgentType = Agent | A2AClient;
//todo: Extend core.Manager interface
export interface IAgentManager {
  getAgent(id: string): AgentType | undefined;
  setAgent(agent: AgentType): Promise<void>;
  deleteAgent(id: string): void;
  getAgents(): AgentType[];
  getAgentCount(): number;
  getAgentIds(): string[];
}
