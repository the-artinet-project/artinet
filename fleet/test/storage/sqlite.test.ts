import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  AgentsTable,
  SQLiteStore,
  createAgentsTable,
  TABLE_NAME,
} from "../../src/storage/sqlite.js";
import { createValidAgentConfig, createValidStoredAgent } from "../mock.js";
const sqlite = new Database(":memory:");
const db = drizzle<AgentsTable>(sqlite);

describe("SQLiteStore", () => {
  let store: SQLiteStore;
  beforeAll(() => {
    createAgentsTable(db);
  });
  beforeEach(() => {
    store = new SQLiteStore(db);
  });
  afterEach(() => {
    sqlite.exec(`DELETE FROM ${TABLE_NAME}`);
  });
  afterAll(() => {
    sqlite.close();
  });
  it("should create a new store", async () => {
    const result = await store.get("test-agent");
    expect(result).toBeUndefined();
  });
  it("should set an agent", async () => {
    await store.set(
      "test-agent",
      createValidStoredAgent({
        uri: "test-agent",
        configuration: createValidAgentConfig({ instructions: "test-prompt" }),
      })
    );
    const result = await store.get("test-agent");
    expect(result).toBeDefined();
    expect(result?.uri).toBe("test-agent");
    expect(result?.configuration?.instructions).toBe("test-prompt");
    expect(result?.version).toBe("1.0.0");
    expect(result?.updatedAt).toBeDefined();
  });
  it("should search for an agent", async () => {
    await store.set(
      "test-agent-id",
      createValidStoredAgent({ uri: "test-agent-id" })
    );
    await store.set(
      "test-agent-2",
      createValidStoredAgent({ uri: "test-agent-2" })
    );
    await store.set(
      "test-agent-3",
      createValidStoredAgent({ uri: "test-agent-3" })
    );
    const result = await store.search("test-agent");
    expect(result).toBeDefined();
    expect(result?.length).toBe(3);
    expect(result?.[0]?.uri).toBe("test-agent-id");
    expect(result?.[1]?.uri).toBe("test-agent-2");
    expect(result?.[2]?.uri).toBe("test-agent-3");
  });
  it("should search for specific agent", async () => {
    await store.set(
      "test-lucky-agent",
      createValidStoredAgent({ uri: "test-lucky-agent" })
    );
    await store.set(
      "test-agent-2",
      createValidStoredAgent({ uri: "test-agent-2" })
    );
    await store.set(
      "test-agent-3",
      createValidStoredAgent({ uri: "test-agent-3" })
    );
    const result = await store.search("test-lucky-agent");
    expect(result).toBeDefined();
    expect(result?.length).toBe(1);
    expect(result?.[0]?.uri).toBe("test-lucky-agent");
  });

  it("should delete an agent", async () => {
    await store.set(
      "test-lucky-agent",
      createValidStoredAgent({ uri: "test-lucky-agent" })
    );
    const set = await store.get("test-lucky-agent");
    expect(set).toBeDefined();
    await store.delete("test-lucky-agent");
    const deleted = await store.get("test-lucky-agent");
    expect(deleted).toBeUndefined();
  });
});
