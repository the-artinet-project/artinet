import { A2A } from "@artinet/sdk";

export const agentCard: A2A.AgentCard = {
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  name: "coding-agent", //rename to your agent name
  description: "A coding agent that generates code.",
  url: "http://localhost:3000/a2a",
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: "code",
      name: "Code",
      description: "A skill that generates code.",
      tags: [],
    },
  ],
};
