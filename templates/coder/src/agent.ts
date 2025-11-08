import { LocalRouter } from "@artinet/router";
import { AgentBuilder, getParts, AgentEngine } from "@artinet/sdk";

export const demoAgent: AgentEngine = AgentBuilder()
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
    const router = new LocalRouter();
    return await router.connect({
      message: {
        identifier: "deepseek-ai/DeepSeek-R1",
        preferredEndpoint: "open-router",
        session: {
          messages: [
            {
              role: "system",
              content:
                "You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.",
            },
            ...(args ?? []),
          ],
        },
      },
    });
  })
  .createAgentEngine();
