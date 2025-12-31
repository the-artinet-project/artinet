import { describe } from "@jest/globals";
import { AgentLoader } from "../src/loader.js";

describe("Agent Loader Tests", () => {
  it("loads a single agent", async () => {
    const agentLoader = new AgentLoader();
    const result = await agentLoader.loadAgents(
      "./test/configs/core/backend-architect.md"
    );
    expect(result.agents).toBeDefined();
    expect(Object.keys(result.agents).length).toBe(1);
  });
  it("loads a multiple agents from a directory", async () => {
    const agentLoader = new AgentLoader();
    const result = await agentLoader.loadAgents("./test/configs/core");
    expect(result.agents).toBeDefined();
    expect(Object.keys(result.agents).length).toBe(7);
  });
});
