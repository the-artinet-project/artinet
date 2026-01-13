/**
 * @fileoverview langchain → artinet
 *
 * @module @artinet/cruiser/langchain
 * @description
 * This adapter "docks" LangChain agents ({@link ReactAgent} and compatible types) onto
 * artinet, enabling them to participate in multi-agent workflows.
 *
 * ## Design Decisions
 *
 * 1. **Message History**: Maintains conversation history by converting {@link sdk.A2A.Message}
 *    to LangChain's {@link HumanMessage}/{@link AIMessage} format before invocation.
 *
 * 2. **Runnable Config**: Accepts LangChain's {@link RunnableConfig} for execution options
 *    like callbacks, tags, and metadata.
 *
 * 3. **Result Handling**: Processes both string and structured responses from
 *    LangChain agents, including message arrays.
 *
 * 4. **Metadata Preservation**: Stores the complete LangChain result in task
 *    metadata for debugging and traceability.
 *
 * ## Usage
 *
 * ```typescript
 * import { createAgent } from "langchain";
 * import { dock } from "@artinet/cruiser/langchain";
 * import { serve } from "@artinet/sdk";
 *
 * const langchainAgent = await createAgent({
 *   model: new ChatOpenAI({ model: "gpt-4" }),
 *   tools: [searchTool, calculatorTool],
 * });
 *
 * const artinetAgent = await dock(langchainAgent, { name: "Research Assistant" });
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://js.langchain.com/docs/modules/agents/} LangChain Agents Docs
 */

import { ReactAgent } from "langchain";
import { RunnableConfig } from "@langchain/core/runnables";
import * as sdk from "@artinet/sdk";
import { Dock, Park } from "../corsair.js";
import {
  getAgentCard,
  convertToLangChainMessage,
  extractA2AMessage,
} from "./utils.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Docks a LangChain agent onto artinet.
 *
 * Transforms a {@link ReactAgent} (or compatible agent type) into an
 * {@link sdk.Agent | artinet-compatible agent} that can be deployed on artinet.
 *
 * @param agent - The {@link ReactAgent} to dock
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize identity and capabilities
 * @param options - Optional {@link RunnableConfig} for execution options
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example Basic Usage
 * ```typescript
 * import { dock } from "@artinet/cruiser/langchain";
 * import { createAgent } from "langchain";
 *
 * const agent = await createAgent({ model, tools });
 * const artinetAgent = await dock(agent, { name: "My Agent" });
 * ```
 *
 * @example With Runnable Configuration
 * ```typescript
 * import { dock } from "@artinet/cruiser/langchain";
 *
 * const artinetAgent = await dock(
 *   myAgent,
 *   { name: "Configured Agent" },
 *   {
 *     callbacks: [new ConsoleCallbackHandler()],
 *     tags: ["production"],
 *     metadata: { userId: "user-123" },
 *   }
 * );
 * ```
 *
 * @example With Custom Agent Card
 * ```typescript
 * import { dock } from "@artinet/cruiser/langchain";
 *
 * const artinetAgent = await dock(myAgent, {
 *   name: "Research Bot",
 *   description: "AI-powered research assistant",
 *   skills: [
 *     { id: "search", name: "Web Search", description: "Search the internet" },
 *     { id: "summarize", name: "Summarization", description: "Summarize documents" },
 *   ],
 * });
 * ```
 */
export const dock: Dock<ReactAgent, RunnableConfig> = async (
  agent: ReactAgent,
  card?: sdk.A2A.AgentCardParams,
  options?: RunnableConfig
): Promise<sdk.Agent> => {
  const agentCard = await getAgentCard({
    agent,
    card,
  });

  sdk.logger.debug(
    `LangChain[${agentCard.name}]:[card:${JSON.stringify(agentCard)}]`
  );

  return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
    sdk.logger.info(
      `LangChain[${agentCard.name}]:[context:${context.contextId}]: starting`
    );

    const task = await context.getTask();

    const history: sdk.A2A.Message[] = sdk.getLatestHistory(task);
    const langchainMessages: (HumanMessage | AIMessage)[] = history.map(
      convertToLangChainMessage
    );
    const result = await agent.invoke({ messages: langchainMessages }, options);
    const responseMessage = extractA2AMessage(
      task.id,
      task.contextId,
      result,
      agent
    );
    const metadata = {
      ...(task.metadata ?? {}),
      result: {
        ...result,
      },
    };

    const completedUpdate: sdk.A2A.TaskStatusUpdateEvent =
      sdk.describe.update.completed({
        taskId: task.id,
        contextId: task.contextId,
        message: responseMessage,
        metadata,
      });

    yield completedUpdate;
  });
};

/**
 * @deprecated Use {@link dock} instead.
 */
export const park: Park<ReactAgent, RunnableConfig> = dock;
