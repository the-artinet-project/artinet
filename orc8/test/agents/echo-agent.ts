/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { A2A, getContent } from "@artinet/sdk";

export const testAgentCard: A2A.AgentCard = {
  description: "A test agent for unit tests",
  name: "test-agent",
  url: "https://test-agent.com",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  capabilities: {
    extensions: [],
    streaming: false,
    pushNotifications: false,
  },
  defaultInputModes: [],
  defaultOutputModes: [],
  skills: [
    {
      id: "test-skill",
      name: "echo",
      description: "Echo the input",
      tags: ["test", "skill", "echo"],
      examples: ["this input will be echoed"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    },
  ],
};

export const echoAgentEngine: A2A.Engine = async function* (
  context: A2A.Context
) {
  const userText = getContent(context.userMessage) ?? "";

  yield {
    kind: "status-update",
    status: {
      state: "working",
      message: {
        kind: "message",
        role: "agent",
        parts: [{ kind: "text", text: `Echo: ${userText}` }],
        messageId: context.userMessage.messageId ?? "",
      },
    },
    taskId: context.taskId,
    contextId: context.contextId,
    final: false,
  };
};
