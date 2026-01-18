import { describe } from "@jest/globals";
import { Loader } from "../src/loader.js";

describe("Agent Loader Tests", () => {
  it("loads a single agent", async () => {
    const agentLoader = new Loader();
    const result = await agentLoader.loadAgents(
      "./test/configs/core/backend-architect.md"
    );
    expect(result.deltas).toBeDefined();
    expect(Object.keys(result.deltas).length).toBe(1);
  });
  it("loads a multiple agents from a directory", async () => {
    const agentLoader = new Loader();
    const result = await agentLoader.loadAgents("./test/configs/core");
    expect(result.deltas).toBeDefined();
    expect(Object.keys(result.deltas).length).toBe(7);
  });
});
