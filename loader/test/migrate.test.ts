import { describe } from "@jest/globals";
import { migrateAgents } from "../src/legacy/migrate.js";
import { AgentLoader } from "../src/loader.js";
import fs from "fs/promises";
describe("Agent Migration Tests", () => {
  it("migrates a single agent", async () => {
    const result = await migrateAgents(
      "./test/configs/migrate/business-analyst.md",
      "./test/configs/migrated/business-analyst-migrated.md"
    );
    expect(result.migratedFiles).toBeDefined();
    expect(result.migratedFiles.length).toBe(1);
    const agentLoader = new AgentLoader();
    const migratedResult = await agentLoader.loadAgents(
      "./test/configs/migrated/business-analyst-migrated.md"
    );
    expect(migratedResult.agents).toBeDefined();
    expect(Object.keys(migratedResult.agents).length).toBe(1);
  });
  it("loads a multiple agents from a directory", async () => {
    const result = await migrateAgents(
      "./test/configs/migrate",
      "./test/configs/migrated"
    );
    expect(result.migratedFiles).toBeDefined();
    expect(result.migratedFiles.length).toBe(3);
    const agentLoader = new AgentLoader();
    const migratedResult = await agentLoader.loadAgents(
      "./test/configs/migrated"
    );
    expect(migratedResult.agents).toBeDefined();
    expect(Object.keys(migratedResult.agents).length).toBe(3);
  });
  afterAll(async () => {
    await fs.rm("./test/configs/migrated", { recursive: true });
  });
});
