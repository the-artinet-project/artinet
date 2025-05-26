import { artinet } from "@artinet/sdk/agents";
import { demoAgent } from "../agent.js";

await artinet.v0.taskManager({ taskHandler: demoAgent });
