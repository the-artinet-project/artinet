/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Callable from "../../module.js";
import { Agent, A2A, AgentMessenger } from "@artinet/sdk";
import { Runtime } from "@artinet/types";

const refreshCache = async (
  callables: Callable.Agent[],
  infos: Map<string, Runtime.AgentInfo>
): Promise<void> => {
  await Promise.all(
    callables.map(async (callable) => {
      const info = await callable.getInfo();
      infos.set(callable.uri, info);
    })
  );
};

const updateCache = async (
  callables: Callable.Agent[],
  infos: Map<string, Runtime.AgentInfo>
): Promise<void> => {
  await Promise.all(
    callables
      .filter((callable) => callable.info)
      .filter((callable) => !infos.has(callable.uri))
      .map(async (callable) => {
        const info = await callable.getInfo();
        infos.set(callable.uri, info);
      })
  );
};

export class Manager extends Callable.Manager {
  private _infos: Map<string, Runtime.AgentInfo> = new Map();

  constructor(agents: Map<string, Agent | AgentMessenger> = new Map()) {
    super(
      new Map(
        Array.from(agents.entries()).map(([id, agent]) => {
          const callable = Callable.Agent.from(agent, id);
          if (callable.info) {
            this._infos.set(id, callable.info);
          }
          return [id, callable];
        })
      )
    );
  }

  get infos(): Map<string, Runtime.AgentInfo> {
    return this._infos;
  }

  /**
   * Tactical cache update to avoid multiple calls to getInfo.
   * This is to avoid the overhead of calling getInfo for each agent.
   * It also ensures that the cache is always up to date.
   * @returns Array of {@link sdk.A2A.AgentCard} agent cards
   */
  async getAgentCards(): Promise<A2A.AgentCard[]> {
    if (this.infos.size === 0 && this.values.length === 0) {
      return [];
    }

    if (this.infos.size === this.values.length) {
      return Array.from(this.infos.values());
    }

    if (this.infos.size < this.values.length) {
      await updateCache(
        this.values.filter((callable) => callable instanceof Callable.Agent),
        this._infos
      );
      return Array.from(this.infos.values());
    }

    await refreshCache(
      this.values.filter((callable) => callable instanceof Callable.Agent),
      this._infos
    );
    return Array.from(this.infos.values());
  }
}
