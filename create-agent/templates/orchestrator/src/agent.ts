import { LocalRouter } from "@artinet/router";
import { AgentEngine, AgentBuilder, getParts, getPayload } from "@artinet/sdk";
import { codingAgentCard } from "./lib/index.js";

const router = new LocalRouter();
export const codingAgentEngine: AgentEngine = AgentBuilder()
  .text(({ context }) => {
    const stateHistory = context.State().task.history ?? [];
    const history = [...stateHistory, ...[context.command.message]];
    const messages = history.map((m) => ({
      role: m.role === "agent" ? ("agent" as const) : ("user" as const),
      content: getParts(m.parts).text,
    }));
    return {
      parts: [`Generating code...`],
      args: messages,
    };
  })
  .text(async ({ args }) => {
    return await router.connect({
      message: {
        identifier: "deepseek-ai/DeepSeek-R1",
        preferredEndpoint: "open-router",
        session: {
          messages: [
            {
              role: "system",
              content: [
                "You are an expert coding assistant.",
                "Provide a high-quality code sample according to the output instructions provided below.",
                "You may generate multiple files as needed.",
              ].join(" "),
            },
            ...(args ?? []),
          ],
        },
      },
    });
  })
  .createAgentEngine();

router.createAgent({
  engine: codingAgentEngine,
  agentCard: codingAgentCard,
});

export const demoAgent: AgentEngine = AgentBuilder()
  .text(() => "Thinking about your request...")
  .text(async ({ command }) => {
    console.log("Orchestrating request...");
    return await router.connect({
      message: {
        identifier: "deepseek-ai/DeepSeek-R1",
        preferredEndpoint: "open-router",
        session: {
          messages: [
            {
              role: "system",
              content: [
                "You are an orchestration agent.",
                "You will be given a request and you will need to pick the best agent to execute the request.",
                "Finally, you will need to synthesize the response from the agents and return the final response to the user.",
              ].join(" "),
            },
            {
              role: "user",
              content: getPayload(command.message).text,
            },
          ],
        },
        options: {
          isAuthRequired: false,
        },
      },
      agents: ["coding-agent"],
    });
  })
  .createAgentEngine();
