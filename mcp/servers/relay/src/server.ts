/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { AgentRelay, AgentRelayConfig } from "@artinet/agent-relay";
import { v4 as uuidv4 } from "uuid";
import {
  TaskSchema,
  AgentCardSchema,
  AgentCard,
  SendMessageSuccessResult,
  Task,
  SendMessageSuccessResultSchema,
  getContent,
  UpdateEvent,
} from "@artinet/sdk";
import { z } from "zod";

class RelayServer extends McpServer {
  private relay: AgentRelay | null = null;
  constructor(
    info: Implementation = {
      name: "agent-relay-server",
      version: "0.0.1",
    },
    options: ServerOptions = {}
  ) {
    super(info, {
      ...options,
      instructions:
        options?.instructions +
        `The relay server is a tool that allows the assistant to:
    - send messages to other agents
    - get information about a task that is currently running orcancel a task that is currently running
    - get information about an agent in the form of an agent card ( which includes the skills of the agent and its capabilities)
    - view the available agents
    - and search for agents based on a query
        
sendMessage - can be used to send a command to another agent.
getTask - can be used to get the status of a task.
cancelTask - can be used to cancel a task that is currently running.
getAgentCard - can be used to get the agent card of an agent. This is useful to get the skills of an agent and understand its capabilities.
viewAgents - can be used to view the available agents. This is useful to get the names of the agents and review their information.
searchAgents - can be used to search for agents based on a query. This is useful to find agents that match a specific skill or name.

The assistant should request viewAgents at the start of a conversation to get the names of the agents and review their information inorder to see if they would be useful for the current request.
The assistant should recall the taskId when sending a follow-up message to the same agent to continue the conversation.
The assistant should be clear and concise when making a request of another agent and provide all the necessary information to the agent to fulfill the request.
If the assistant lacks the ability to fulfill a request it should check if there are any other agents that would be able to fulfill the request and if another agent is available for the task, the assistant should send detailed instructions to the other agent to fulfill the request.
If no other agent is available for the task, the assistant should return a message to the user indicating that no other agent is available for the task.
If the assistant determines that the request has not been adequately fulfilled by the other agent, the assistant must determine whether to call the same agent again or call a different agent or to ask the user for clarification.
Upon completion of the request, the assistant should return the result to the user.
The assistant should always return the result to the user in a clear and concise manner.
      `,
    });
  }
  override async close(): Promise<void> {
    await this.relay?.close();
    await super.close();
  }
  public async init(config: AgentRelayConfig) {
    this.relay = await AgentRelay.create(config);
    this.registerTool(
      "sendMessage",
      {
        title: "Send Message",
        description:
          "A message will be sent to the target agent and a response object containing the full details of request will be returned to the assistant. Which contains the task id and the message sent to the agent, the conversation history and the artifacts created by the agent.",
        inputSchema: z.object({
          agentId: z
            .string()
            .describe("The id of the agent to send the message to."),
          message: z.string().describe("The message to send to the agent."),
          taskId: z
            .string()
            .describe(
              "The id of the task that the message is related to. If not provided, a new task will be created."
            )
            .optional(),
        }).shape,
        outputSchema: z.object({
          result: SendMessageSuccessResultSchema,
        }).shape,
      },
      async (args) => {
        const result: SendMessageSuccessResult | undefined =
          await this.relay?.sendMessage({
            agentId: args.agentId,
            messageSendParams: {
              message: {
                role: "user",
                messageId: uuidv4(),
                kind: "message",
                parts: [{ text: args.message, kind: "text" }],
                taskId: args.taskId ?? uuidv4(),
              },
            },
          });
        return {
          content: [
            {
              type: "text",
              text:
                getContent(result as unknown as UpdateEvent) ??
                "No result from the agent. This may be because the agent is not responding or the message was not sent.",
            },
          ],
          structuredContent: {
            result: result,
          },
        };
      }
    );

    this.registerTool(
      "getTask",
      {
        title: "Get Task",
        description: "Get the status of a running task from an agent",
        inputSchema: z
          .object({
            agentId: z
              .string()
              .describe("The id of the agent to get the task from."),
            taskId: z.string().describe("The id of the task to get."),
          })
          .describe(
            "The agent id and task query to get the status of a running task from the agent."
          ).shape,
        outputSchema: TaskSchema.shape,
      },
      async (args) => {
        const result: Task | undefined = await this.relay?.getTask({
          agentId: args.agentId,
          taskQuery: {
            id: args.taskId,
            metadata: {},
            historyLength: undefined,
          },
        });
        return {
          content: [
            {
              type: "text",
              text:
                result?.status?.state ??
                "No task found. This may be because the task is not running or the agent is not responding.",
            },
          ],
          structuredContent: result,
        };
      }
    );

    this.registerTool(
      "cancelTask",
      {
        title: "Cancel Task",
        description: "Cancel a running task from an agent",
        inputSchema: z
          .object({
            agentId: z
              .string()
              .describe("The id of the agent to cancel the task from."),
            taskId: z.string().describe("The id of the task to cancel."),
          })
          .describe(
            "The agent id and task id to cancel a running task from the agent."
          ).shape,
        outputSchema: TaskSchema.shape,
      },
      async (args) => {
        const result: Task | undefined = await this.relay?.cancelTask({
          agentId: args.agentId,
          taskId: {
            id: args.taskId,
            metadata: {},
          },
        });
        return {
          content: [
            {
              type: "text",
              text:
                result?.status?.state ??
                "No task found. This may be because the task is not running or the agent is not responding.",
            },
          ],
          structuredContent: result,
        };
      }
    );

    this.registerTool(
      "getAgentCard",
      {
        title: "Get Agent Card",
        description:
          "Get the AgentCard that describes the capabilities and skills of an agent",
        inputSchema: z.object({
          agentId: z
            .string()
            .describe("The id of the agent to get the agent card from."),
        }).shape,
        outputSchema: AgentCardSchema.shape,
      },
      async (args) => {
        const result: AgentCard | undefined = await this.relay?.getAgentCard({
          agentId: args.agentId,
        });
        const text: string = result
          ? JSON.stringify(result, null, 2)
          : "No agent card found. This may be because the agent is not registered or the agent is not responding.";
        return {
          content: [
            {
              type: "text",
              text: text,
            },
          ],
          structuredContent: result,
        };
      }
    );
    this.registerTool(
      "viewAgents",
      {
        title: "View Agents",
        description: "View the agents that are registered with the relay.",
        outputSchema: z.object({
          agents: z
            .array(AgentCardSchema)
            .describe("The agents that are registered with the relay."),
        }).shape,
      },
      async () => {
        const result: AgentCard[] = (await this.relay?.getAgentCards()) ?? [];
        const text: string =
          result && result.length > 0
            ? JSON.stringify({ agents: result }, null, 2)
            : "No agents registered with the relay.";
        return {
          content: [
            {
              type: "text" as const,
              text: text,
            },
          ],
          structuredContent: {
            agents: result ?? [],
          },
        };
      }
    );
    this.registerTool(
      "searchAgents",
      {
        title: "Search Agents",
        description:
          "Search for agents by name, description, or skills. The query is case insensitive and will match against the entire name, description, and skills of the agents.",
        inputSchema: z.object({
          query: z.string().describe("The query to search against."),
        }).shape,
        outputSchema: z.object({
          agents: z
            .array(AgentCardSchema)
            .describe("The agents that match the query."),
        }).shape,
      },
      async (args) => {
        const result: AgentCard[] =
          (await this.relay?.searchAgents({ query: args.query })) ?? [];
        const text: string =
          result && result.length > 0
            ? JSON.stringify({ agents: result }, null, 2)
            : "No agents found. This may be because the query is not valid or the agents are not responding.";
        return {
          content: [
            {
              type: "text",
              text: text,
            },
          ],
          structuredContent: {
            agents: result,
          },
        };
      }
    );
  }
}

export { RelayServer };
