/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { API, Runtime } from "@artinet/types";

/**
 * Extracts the text content from an Artinet message.
 * @param content - The content of the message.
 * @returns The text content of the message.
 */
export function extractMessageContent(content: API.Message["content"]): string {
  if (typeof content === "string") return content;
  if (typeof content === "object" && "text" in content) return content.text;
  return "";
}

export function agentResponse(
  message: API.ConnectResponse["message"]
): Runtime.AgentResponse["result"] {
  if (typeof message.content === "string") return message.content;
  if (!message.content) {
    throw new Error("No content found in message");
  }
  return message.content.text;
}
