/**
 * @fileoverview
 * Basic Agent Card
 *
 * This file defines the card for the basic agent.
 */
import { AgentCard } from "@artinet/sdk";

export const agentCard: AgentCard = {
  name: "basic-agent",
  description: "A simple agent that returns your original message.",
  url: "http://localhost:3000/a2a",
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  version: "1.0.0",
  capabilities: {
    streaming: true,
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
