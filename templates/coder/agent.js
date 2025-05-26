import { artinet } from "@artinet/sdk/agents";

export async function* demoAgent({ task, history }) {
  history = [...history, ...(task.status.message ? [task.status.message] : [])];
  const messages = (history ?? [])
    .map((m) => ({
      role: m.role === "agent" ? "model" : "user",
      content: m.parts
        .filter((p) => !!p.text)
        .map((p) => p.text)
        .join("\n"),
    }))
    .filter((m) => m.content.length > 0);

  if (messages.length === 0) {
    console.warn(`[CoderAgent] No history/messages found for task ${task.id}`);
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [{ type: "text", text: "No input message found." }],
      },
    };
    return;
  }

  yield {
    state: "working",
    message: {
      role: "agent",
      parts: [{ type: "text", text: "Generating code..." }],
    },
  };
  
  //the artinet api returns objects from other contexts, requiring a deep copy to avoid mishandling.
  const response = await artinet.v0.connect({
    agentId: "Qwen/Qwen2.5-Coder-32B-Instruct",
    messages: [
      {
        role: "system",
        content:
          "You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.",
      },
      ...messages,
    ],
  });

  console.log("response: ", response);
  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [
        {
          type: "text",
          text: response,
        },
      ],
    },
  };
}
