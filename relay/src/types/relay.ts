/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { ScanConfig } from "./config.js";
import { AgentType, IAgentManager } from "./manager.js";
import {
  ClientConfig,
  SendRelayMessageRequest,
  GetRelayTaskRequest,
  CancelRelayTaskRequest,
  AgentRelayRequest,
  SearchRelayRequest,
} from "./schema.js";
import { A2A } from "@artinet/sdk";

export interface IAgentRelay extends IAgentManager {
  discoverAgents(config: ScanConfig): Promise<A2A.AgentCard[]>;
  registerAgent(agent: AgentType | ClientConfig): Promise<A2A.AgentCard>;
  deregisterAgent(agentId: string): Promise<void>;
  sendMessage(
    params: SendRelayMessageRequest
  ): Promise<A2A.SendMessageSuccessResult>;
  getTask(params: GetRelayTaskRequest): Promise<A2A.Task>;
  cancelTask(params: CancelRelayTaskRequest): Promise<A2A.Task>;
  getAgentCard(params: AgentRelayRequest): Promise<A2A.AgentCard | undefined>;
  searchAgents(params: SearchRelayRequest): Promise<A2A.AgentCard[]>;
}
