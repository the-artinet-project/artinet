/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GetTaskRequest,
  CancelTaskRequest,
  SendMessageRequest,
  RelayRequest,
  SearchRequest,
} from "./schema.js";
import {
  A2A,
  MessengerParams,
  type Agent,
  type AgentMessenger,
} from "@artinet/sdk";

export interface Registry {
  registerAgent(
    agent: MessengerParams | Agent | AgentMessenger
  ): Promise<A2A.AgentCard>;
  deregisterAgent(agentId: string): Promise<void>;
}

export interface Relay extends Registry {
  sendMessage(
    params: SendMessageRequest
  ): Promise<A2A.SendMessageSuccessResult>;
  getTask(params: GetTaskRequest): Promise<A2A.Task>;
  cancelTask(params: CancelTaskRequest): Promise<A2A.Task>;
  getAgentCard(params: RelayRequest): Promise<A2A.AgentCard | undefined>;
  searchAgents(params: SearchRequest): Promise<A2A.AgentCard[]>;
}
