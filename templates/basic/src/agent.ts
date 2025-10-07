/**
 * @fileoverview
 * Basic Agent Example
 *
 * This example demonstrates how to create a simple agent
 * that responds to incoming tasks.
 */
import { AgentEngine, getPayload, AgentBuilder } from "@artinet/sdk";

export const demoAgent: AgentEngine = AgentBuilder()
  .text(({ command }) => {
    const userText = getPayload(command.message).text;
    return {
      parts: [`Processing request: ${userText}`],
      args: [userText],
    };
  })
  .text(
    ({ args }) => `You said: "${args?.[0]}". This is an echo server example.`
  )
  .createAgentEngine();
