export const agentCard = {
  name: "basic-agent", //rename to your agent name
  description: "A simple agent that returns your original message.",
  url: "https://basic-agent.example.com/api", //will be overridden by the artinet
  version: "1.0.0",
  capabilities: {
    //currently unsupported
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: "echo",
      name: "Echo",
      description: "A simple skill that returns your original message.",
    },
  ],
};
