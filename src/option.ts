#!/usr/bin/env node
export const templates = [
  {
    value: "basic",
    title: "echo agent",
    description:
      "a simple echo agent that returns your original message. (best for beginners)",
  },
  {
    value: "coder",
    title: "coding agent",
    description:
      "a coding agent that will return code snippets based on the callers request.",
  },
  {
    value: "orchestrator",
    title: "orchestrator agent",
    description: "an orchestration agent that can invoke other agents.",
  },
];
