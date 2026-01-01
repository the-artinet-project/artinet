/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import { AgentConfiguration } from "agent-def";
import { eq, like, or } from "drizzle-orm";
import { BaseSQLiteDatabase, sqliteTable, text } from "drizzle-orm/sqlite-core";

const CREATE_AGENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS fleet_agents (agentUri TEXT PRIMARY KEY, agentId TEXT NOT NULL, name TEXT NOT NULL, prompt TEXT NOT NULL, modelId TEXT NOT NULL, agents TEXT NOT NULL, version TEXT NOT NULL, updatedAt TEXT NOT NULL, status TEXT NOT NULL, visibility TEXT NOT NULL, owner TEXT NOT NULL, metadata TEXT NOT NULL)`;

export const createAgentsTable = async (
  db: BaseSQLiteDatabase<`sync` | `async`, any, AgentsTable>
): Promise<void> => {
  await db.run(CREATE_AGENTS_TABLE_SQL);
};

export const agentsTable = sqliteTable("fleet_agents", {
  agentUri: text().primaryKey(),
  /**
   * @deprecated Use agentUri instead
   */
  agentId: text().notNull().default(""),
  name: text().notNull(),
  /**
   * @deprecated Use metadata instead
   */
  prompt: text().notNull().default(""),
  /**
   * @deprecated Use metadata instead
   */
  modelId: text().notNull().default(""),
  /**
   * @deprecated Use metadata instead
   */
  agents: text("agents", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  version: text().notNull(),
  updatedAt: text().notNull(),
  status: text("status", { mode: "json" })
    .$type<"ACTIVE" | "INACTIVE">()
    .notNull(),
  visibility: text("visibility", { mode: "json" })
    .$type<"PUBLIC" | "PRIVATE">()
    .notNull(),
  owner: text().notNull(),
  metadata: text("metadata", { mode: "json" })
    .$type<AgentConfiguration>()
    .notNull(),
});

export type AgentsTable = typeof agentsTable.$inferSelect;

export class SQLiteStore implements armada.IDataStore<armada.StoredAgent> {
  constructor(
    private db: BaseSQLiteDatabase<`sync` | `async`, any, AgentsTable>
  ) {
    createAgentsTable(db);
  }

  async get(id: string): Promise<armada.StoredAgent | undefined> {
    return await this.db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.agentUri, id))
      .get();
  }

  async set(id: string, data: armada.StoredAgent): Promise<void> {
    await this.db
      .insert(agentsTable)
      /**forcing this until we sync the schemas properly */
      .values({ ...(data as any), agentUri: id })
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(agentsTable)
      .where(eq(agentsTable.agentUri, id))
      .execute();
  }

  async search(query: string): Promise<armada.StoredAgent[]> {
    return await this.db
      .select()
      .from(agentsTable)
      .where(
        or(
          eq(agentsTable.agentUri, query),
          like(agentsTable.name, `%${query}%`),
          like(agentsTable.prompt, `%${query}%`),
          like(agentsTable.modelId, `%${query}%`),
          like(agentsTable.metadata, `%${query}%`)
        )
      )
      .execute();
  }
}
