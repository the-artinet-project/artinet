import { AgentCard } from "@artinet/sdk";

export const agentCard: AgentCard = {
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  name: "orchestrator-agent", //rename to your agent name
  description:
    "An orchestrator agent that can call other agents to get the information it needs.",
  url: "http://localhost:3000/a2a",
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: "orchestrate",
      name: "Orchestrate",
      description:
        "A skill that orchestrates the execution of other agents to get the information it needs.",
    },
  ],
};

export const codingAgentCard: AgentCard = {
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  name: "coding-agent", //rename to your agent name
  description: "A coding agent that generates code.",
  url: "http://localhost:3001/a2a",
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
    },
  ],
};
