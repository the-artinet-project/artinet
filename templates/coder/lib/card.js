export const agentCard = {
  name: "coder-agent", //rename to your agent name
  description: "A coder agent that generates code.",
  url: "https://coder-agent.example.com/api", //will be overridden by the artinet
  version: "1.0.0",
  capabilities: {
    //currently unsupported
    streaming: false,
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
