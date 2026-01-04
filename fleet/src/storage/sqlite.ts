/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import { AgentConfiguration } from "agent-def";
import { eq, like, or } from "drizzle-orm";
import { BaseSQLiteDatabase, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const TABLE_NAME = "fleet_agents";
const CREATE_AGENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (uri TEXT PRIMARY KEY, \
name TEXT NOT NULL, \
version TEXT NOT NULL, \
updatedAt TEXT NOT NULL, \
status TEXT NOT NULL, \
visibility TEXT NOT NULL, \
owner TEXT NOT NULL, \
configuration TEXT NOT NULL)`;

export const createAgentsTable = async (
  db: BaseSQLiteDatabase<`sync` | `async`, any, AgentsTable>
): Promise<void> => {
  await db.run(CREATE_AGENTS_TABLE_SQL);
};

export const agentsTable = sqliteTable(TABLE_NAME, {
  uri: text().primaryKey(),
  name: text().notNull(),
  version: text().notNull(),
  updatedAt: text().notNull(),
  status: text("status", { mode: "json" })
    .$type<"ACTIVE" | "INACTIVE">()
    .notNull(),
  visibility: text("visibility", { mode: "json" })
    .$type<"PUBLIC" | "PRIVATE">()
    .notNull(),
  owner: text().notNull(),
  configuration: text("configuration", {
    mode: "json",
  }).$type<AgentConfiguration>(),
});

export type AgentsTable = typeof agentsTable.$inferSelect;
//TODO: Extend Manager for caching
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
      .where(eq(agentsTable.uri, id))
      .get();
  }

  async set(id: string, data: armada.StoredAgent): Promise<void> {
    if (id !== data.uri) {
      throw new Error("URI mismatch");
    }
    await this.db
      .insert(agentsTable)
      .values({ ...data, uri: id })
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(agentsTable).where(eq(agentsTable.uri, id)).execute();
  }

  async search(query: string): Promise<armada.StoredAgent[]> {
    const trimmedQuery = query.trim();
    return await this.db
      .select()
      .from(agentsTable)
      .where(
        or(
          eq(agentsTable.uri, trimmedQuery),
          like(agentsTable.name, `%${trimmedQuery}%`),
          like(agentsTable.configuration, `%${trimmedQuery}%`)
        )
      )
      .execute();
  }
}
