import { AgentBuilder, createAgentServer } from "@artinet/sdk";

const { app } = createAgentServer({
  agent: AgentBuilder()
    .text(({ content }) => `You said: ${content}`)
    .createAgent({
      agentCard: {
        name: "test-server",
        url: "http://localhost:3000/a2a",
        description: "A test server",
        version: "1.0.0",
        protocolVersion: "0.3.0",
        capabilities: {
          streaming: true,
        },
        defaultInputModes: ["text"],
        defaultOutputModes: ["text"],
        skills: [
          {
            id: "test-skill",
            name: "test-skill",
            description: "A test skill",
          },
        ],
      },
    }),
  basePath: "/a2a",
});

app.listen(3000, () => {
  console.log("Test server running on http://localhost:3000/a2a");
});
