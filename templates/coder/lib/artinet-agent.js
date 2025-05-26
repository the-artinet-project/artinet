import { demoAgent } from "../agent.js";
import { artinet } from "@artinet/sdk/agents";

await artinet.v0.taskManager({ taskHandler: demoAgent });
