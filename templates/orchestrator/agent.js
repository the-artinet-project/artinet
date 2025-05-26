import { artinet } from "@artinet/sdk/agents";

export async function* demoAgent({ userMessage, isCancelled }) {
  yield {
    state: "working",
    message: {
      role: "agent",
      parts: [{ text: "Thinking about your request...", type: "text" }],
    },
  };

  const userText = userMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ");

  // Create a response
  let response = `Failed to send task`;

  try {
    const agentClient = artinet.v0.agent({
      baseUrl:
        "https://agents.artinet.io/agentId=0x88a03f820c633d580f37e9dae1487a32ae2f59b42eafe0f8396c5a902507f349",
      headers: {},
    });
    const message = {
      role: "user",
      parts: [
        {
          type: "text",
          text: "Write a python function to share files remotely. Please be concise and respond with code only. Please use the following format: def share_files(files: list[str]) -> str: ...",
        },
      ],
    };
    const task = await agentClient.sendTask({
      id: "111",
      message: message,
    });
    yield {
      state: task?.status?.state || "working",
      message: task?.status?.message
        ? {
            role: "agent",
            parts: task?.status?.message?.parts.map((part) => ({
              ...part,
              text: part.type === "text" ? part.text : "",
            })),
          }
        : {
            role: "agent",
            parts: [{ text: "Task sent to Artinet...", type: "text" }],
          },
    };
    //the artinet api returns objects from other contexts, requiring a deep copy to avoid mishandling.
    const returnedTask = { ...task };
    response = returnedTask;
  } catch (error) {
    console.error("Error sending task: ", error);
    response = "Failed to send task: " + JSON.stringify(error, null, 2);
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [{ text: "Error sending task: " + error, type: "text" }],
      },
    };
  }
  // Check for task cancellation
  if (isCancelled()) {
    yield {
      state: "canceled",
      message: {
        role: "agent",
        parts: [{ text: "Processing has been cancelled.", type: "text" }],
      },
    };
    return;
  }

  // Yield a completed status with response message
  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [{ text: response, type: "text" }],
    },
  };
}
