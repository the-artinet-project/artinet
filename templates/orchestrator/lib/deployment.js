import { bundle } from "@artinet/sdk";
import { agentCard } from "./card.js";
export const deployment = {
  name: agentCard.name, //rename to your agent name
  code: await bundle(new URL("./artinet-agent.js", import.meta.url)), //must be a file path to an agent being consumed by artinet.v0.taskManager function
  agentCard: agentCard,
};
// console.log("deployment", deployment);
