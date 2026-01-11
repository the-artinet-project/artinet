/**
 * @fileoverview claude → artinet
 *
 * @module @artinet/cruiser/claude
 * @description
 * This adapter "parks" {@link ClaudeAgent | Claude agents} (from `@anthropic-ai/claude-agent-sdk`) onto
 * artinet, enabling them to participate in multi-agent workflows.
 *
 * 1. **Execution Model**: claude agents use the `query({ prompt })` function for execution.
 *    Unlike other SDKs, it handles conversation history internally.
 *
 * 2. **Streaming Support**: Utilizes claude's async iterator pattern for streaming
 *    responses, yielding {@link sdk.A2A.TaskStatusUpdateEvent} during execution.
 *
 * 3. **Code-First Design**: claude agents are optimized for coding tasks and accepts
 *    a `workingDir` parameter for file system operations.
 *
 * 4. **Simple Interface**: claude agents have a straightforward API, making this
 *    adapter relatively simple compared to other frameworks.
 * 
 * 5. **Options Passthrough**: Unlike other parks we need to build the query request manually, 
 *    to ensure that we have access to required parameters that are needed to scaffold the {@link park}.
 *    The {@link Options} object is passed through to the claude agent SDK during execution.
 *
 * ## Usage
 *
 * ```typescript
 * import { Options } from "@anthropic-ai/claude-agent-sdk";
 * import { park } from "@artinet/cruiser/claude";
 * import { serve } from "@artinet/sdk";
 *
 * const claudeConfig: Options = {
 *  model: "claude-sonnet-4-20250514",
    maxTurns: 1,
 * };
 *
 * const artinetAgent = await park(claudeConfig, { name: "Claude Coder" });
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://docs.anthropic.com/en/docs/claude-agent-sdk} Claude Agent SDK Docs
 */

import * as sdk from "@artinet/sdk";
import { Park } from "../corsair.js";
import * as claude from "@anthropic-ai/claude-agent-sdk";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { type ClaudeAgent, getAgentCard, extractA2AMessage } from "./utils.js";

/**
 * Configuration options passed to the Claude Agent SDK during execution.
 * @see {@link Options} from `@anthropic-ai/claude-agent-sdk`
 */
export type ParkOptions = Options;

/**
 * Parks a Claude Agent onto artinet.
 *
 * Transforms a {@link ClaudeAgent} instance into an {@link sdk.Agent | artinet-compatible agent}
 * that can be deployed on artinet and communicate with other artinet agents.
 *
 * @param agent - The {@link ClaudeAgent} configuration (Options) to park
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize identity and capabilities
 * @param _options - Reserved for future use (currently unused)
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example Basic Usage
 * ```typescript
 * import { park } from "@artinet/cruiser/claude";
 *
 * const a2agent = await park(
 *   { model: "claude-sonnet-4-20250514", maxTurns: 1 },
 *   { name: "My Claude Agent" }
 * );
 * ```
 *
 * @example With Custom System Prompt
 * ```typescript
 * import { park } from "@artinet/cruiser/claude";
 *
 * const a2agent = await park(
 *   {
 *     cwd: "./my-project",
 *     model: "claude-sonnet-4-20250514",
 *     tools: ["Read", "Write", "Bash"],
 *   },
 *   {
 *     name: "TypeScript Expert",
 *     description: "Expert assistance for TypeScript development",
 *   }
 * );
 * ```
 *
 * @example With Working Directory for Code Tasks
 * ```typescript
 * import { park } from "@artinet/cruiser/claude";
 *
 * const a2agent = await park(
 *   {
 *     cwd: "./my-project",
 *     model: "claude-sonnet-4-20250514",
 *     tools: ["Read", "Write", "Bash"],
 *   },
 *   { name: "Project Assistant" }
 * );
 * ```
 */
export const park: Park<ClaudeAgent, never> = async (
  agent: ClaudeAgent,
  card?: sdk.A2A.AgentCardParams,
  _options?: never
): Promise<sdk.Agent> => {
  const agentCard = await getAgentCard({ agent, card });

  sdk.logger.debug(
    `Claude[${agentCard.name}]:[card:${JSON.stringify(agentCard)}]`
  );

  return sdk.cr8(agentCard).from(async function* (context: sdk.A2A.Context) {
    sdk.logger.debug(
      `Claude[${agentCard.name}]:[context:${context.contextId}]: starting`
    );

    const userMessage = sdk.extractTextContent(context.userMessage);
    if (!userMessage) {
      yield sdk.describe.update.failed({
        taskId: context.taskId,
        contextId: context.contextId,
        message: sdk.describe.message({
          taskId: context.taskId,
          contextId: context.contextId,
          parts: [sdk.describe.part.text("no user message detected")],
        }),
      });
      return;
    }

    let metadata: unknown = {};
    let ret: sdk.A2A.Message | undefined;
    try {
      /**For now we instantiate a new query object on each invocation
       * In the future we can leverage the input stream;
       */
      const stream: claude.Query = claude.query({
        prompt: userMessage,
        options: {
          ...agent,
          includePartialMessages: false, //No partial messages
        },
      });

      for await (const message of stream) {
        if (message.type === "assistant") {
          ret = extractA2AMessage(context.taskId, context.contextId, message);
          yield sdk.describe.update.working({
            taskId: context.taskId,
            contextId: context.contextId,
            message: ret,
          });
          continue;
        }

        metadata = {
          ...(metadata ?? {}),
          ...message,
        };
      }
    } catch (error) {
      yield sdk.describe.update.failed({
        taskId: context.taskId,
        contextId: context.contextId,
        message: sdk.describe.message({
          taskId: context.taskId,
          contextId: context.contextId,
          parts: [sdk.describe.part.text("error querying agent")],
        }),
      });
      return;
    }

    if (!ret) {
      yield sdk.describe.update.failed({
        taskId: context.taskId,
        contextId: context.contextId,
        message: sdk.describe.message({
          taskId: context.taskId,
          contextId: context.contextId,
          parts: [sdk.describe.part.text("no response from agent")],
        }),
      });
      return;
    }

    yield sdk.describe.update.completed({
      taskId: context.taskId,
      contextId: context.contextId,
      message: ret,
      metadata: {
        ...(metadata ?? {}),
      },
    });
    return;
  });
};

// Re-export the ClaudeAgent type for convenience
export type { ClaudeAgent } from "./utils.js";
