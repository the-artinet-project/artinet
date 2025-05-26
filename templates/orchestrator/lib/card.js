export const agentCard = {
  name: "orchestrator-agent", //rename to your agent name
  description:
    "An orchestrator agent that can call other agents to get the information it needs.",
  url: "https://orchestrator-agent.example.com/api", //will be overridden by the artinet
  version: "1.0.0",
  capabilities: {
    //currently unsupported
    streaming: false,
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
