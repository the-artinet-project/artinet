/**
 * @fileoverview
 * Basic Agent Example
 *
 * This example demonstrates how to create a simple agent
 * that responds to incoming tasks.
 */
import { cr8, AgentEngine } from "@artinet/sdk";

export const demoAgent: AgentEngine = cr8("Echo Agent")
  .text(({ content: userText }) => ({
    reply: [`Processing request: ${userText}`],
    args: { userText },
  }))
  .text(
    ({ args }) =>
      `You said: "${args?.userText}". This is an echo server example.`
  ).engine;
