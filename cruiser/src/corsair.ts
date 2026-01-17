/**
 * @fileoverview Core type definitions for Cruiser adapters
 *
 * @module @artinet/cruiser/corsair
 * @description
 * Defines the universal {@link Dock} interface that all framework adapters must implement.
 * The "dock" metaphor represents the process of connecting (docking) an agent from
 * any framework onto artinet.
 *
 * ## Naming Convention
 *
 * - **Dock**: The adapter function that transforms a framework-specific agent
 *   into an {@link sdk.Agent}
 * - **Corsair**: The module containing the core type definitions (cruiser's helm)
 *
 * @example
 * ```typescript
 * import type { Dock } from "@artinet/cruiser";
 *
 * // All adapters follow this signature
 * const dock: Dock<MyAgentType, MyOptionsType> = async (agent, card, options) => {
 *   // Transform agent into A2A format
 *   return artinetAgent;
 * };
 * ```
 */

import type * as sdk from "@artinet/sdk";

/**
 * Universal dock function signature for framework adapters.
 *
 * All Cruiser adapters implement this interface to ensure consistent behavior
 * across different agent frameworks. The dock function transforms a framework-
 * specific agent into an {@link sdk.Agent} that can be deployed on Artinet.
 *
 * @typeParam TAgent - The framework-specific agent type (e.g., {@link OpenAIAgent}, {@link MastraAgent})
 * @typeParam TOptions - Optional configuration type for the adapter (defaults to unknown)
 *
 * @param agent - The framework-specific agent instance to dock
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize the agent's identity,
 *               capabilities, and skills in the A2A network
 * @param options - Framework-specific execution options passed through to the underlying SDK
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example
 * ```typescript
 * import { dock } from "@artinet/cruiser/openai";
 * import { Agent } from "@openai/agents";
 *
 * // Create your framework-specific agent
 * const openaiAgent = new Agent({
 *   name: "assistant",
 *   instructions: "You are a helpful assistant",
 * });
 *
 * // Dock it into the Artinet ecosystem
 * const artinetAgent = await dock(openaiAgent, {
 *   name: "My Assistant",
 *   description: "A helpful AI assistant for general queries",
 * });
 *
 * // Now deploy using @artinet/sdk
 * import { serve } from "@artinet/sdk";
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://github.com/google-a2a/A2A} A2A Protocol Specification
 */
export type Dock<TAgent, TOptions = unknown> = (
  agent: TAgent,
  card?: sdk.A2A.AgentCardParams,
  options?: TOptions
) => Promise<sdk.Agent>;

/**
 * Universal dock function signature for framework adapters.
 *
 * All Cruiser adapters implement this interface to ensure consistent behavior
 * across different agent frameworks. The dock function transforms a framework-
 * specific agent into an {@link sdk.Agent} that can be deployed on Artinet.
 *
 * @typeParam TAgent - The framework-specific agent type (e.g., {@link OpenAIAgent}, {@link MastraAgent})
 * @typeParam TOptions - Optional configuration type for the adapter (defaults to unknown)
 *
 * @param agent - The framework-specific agent instance to dock
 * @param card - Optional {@link sdk.A2A.AgentCardParams} configuration to customize the agent's identity,
 *               capabilities, and skills in the A2A network
 * @param options - Framework-specific execution options passed through to the underlying SDK
 *
 * @returns A Promise resolving to an {@link sdk.Agent} ready for deployment
 *
 * @example
 * ```typescript
 * import { park } from "@artinet/cruiser/openai";
 * import { Agent } from "@openai/agents";
 *
 * // Create your framework-specific agent
 * const openaiAgent = new Agent({
 *   name: "assistant",
 *   instructions: "You are a helpful assistant",
 * });
 *
 * // Dock it into the Artinet ecosystem
 * const artinetAgent = await park(openaiAgent, {
 *   name: "My Assistant",
 *   description: "A helpful AI assistant for general queries",
 * });
 *
 * // Now deploy using @artinet/sdk
 * import { serve } from "@artinet/sdk";
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * @see {@link https://github.com/google-a2a/A2A} A2A Protocol Specification
 */

export type Park<TAgent, TOptions = unknown> = Dock<TAgent, TOptions>;
