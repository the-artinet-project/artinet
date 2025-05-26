/**
 * Basic Agent Example
 *
 * This example demonstrates how to create a simple agent
 * that responds to incoming tasks.
 */

export async function* demoAgent(context) {
  // Extract the user's message
  const userText = context.userMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ");

  console.log(`Processing request: ${userText}`);

  // Send a "working" status update
  yield {
    state: "working",
    message: {
      role: "agent",
      parts: [{ text: "Thinking about your request...", type: "text" }],
    },
  };

  // Simulate some work with delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Check for task cancellation
  if (context.isCancelled()) {
    console.log("Task was cancelled");
    yield {
      state: "canceled",
      message: {
        role: "agent",
        parts: [{ text: "Processing has been cancelled.", type: "text" }],
      },
    };
    return;
  }

  // Create a response
  const response = `You said: "${userText}". This is an echo server example.`;

  // Yield an artifact (optional)
  yield {
    name: "response.txt",
    parts: [{ text: response, type: "text" }],
  };

  // Yield a completed status with response message
  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [{ text: response, type: "text" }],
    },
  };
}
