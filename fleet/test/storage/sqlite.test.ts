import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  AgentsTable,
  SQLiteStore,
  createAgentsTable,
  TABLE_NAME,
} from "../../src/storage/sqlite.js";
import { createValidStoredAgent } from "../mock.js";
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
    await store.set("test-agent", createValidStoredAgent());
    const result = await store.get("test-agent");
    expect(result).toBeDefined();
    expect(result?.agentId).toBe("test-agent-id");
    expect(result?.name).toBe("test-agent");
    expect(result?.prompt).toBe("test-prompt");
    expect(result?.modelId).toBe("test-model-id");
    expect(result?.version).toBe("1.0.0");
    expect(result?.updatedAt).toBeDefined();
  });
  it("should search for an agent", async () => {
    await store.set("test-agent", createValidStoredAgent());
    await store.set(
      "test-agent-2",
      createValidStoredAgent({ name: "test-agent-2", agentId: "number2" })
    );
    await store.set(
      "test-agent-3",
      createValidStoredAgent({ name: "test-agent-3", agentId: "number3" })
    );
    const result = await store.search("test-agent");
    expect(result).toBeDefined();
    expect(result?.length).toBe(3);
    expect(result?.[0]?.agentId).toBe("test-agent-id");
    expect(result?.[1]?.agentId).toBe("number2");
    expect(result?.[2]?.agentId).toBe("number3");
  });
  it("should search for specific agent", async () => {
    await store.set(
      "test-lucky-agent",
      createValidStoredAgent({ agentId: "number1" })
    );
    await store.set(
      "test-agent-2",
      createValidStoredAgent({ name: "test-agent-2", agentId: "number2" })
    );
    await store.set(
      "test-agent-3",
      createValidStoredAgent({ name: "test-agent-3" })
    );
    const result = await store.search("test-lucky-agent");
    expect(result).toBeDefined();
    expect(result?.length).toBe(1);
    expect(result?.[0]?.agentId).toBe("number1");
  });

  it("should delete an agent", async () => {
    await store.set(
      "test-lucky-agent",
      createValidStoredAgent({ agentId: "number1" })
    );
    const set = await store.get("test-lucky-agent");
    expect(set).toBeDefined();
    await store.delete("test-lucky-agent");
    const deleted = await store.get("test-lucky-agent");
    expect(deleted).toBeUndefined();
  });
});
