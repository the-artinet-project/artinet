/**
 * @fileoverview Artinet Cruiser - Agent Framework Adapters
 *
 * @module @artinet/cruiser
 * @version 0.1.0
 * @license Apache-2.0
 *
 * @description
 * Cruiser provides universal adapters ("parks") that bridge popular AI agent
 * frameworks to the Agent2Agent (A2A) protocol, enabling multi-agent
 * interoperability through the {@link @artinet/sdk | Artinet SDK}.
 *
 * ## Supported Frameworks
 *
 * | Framework  | Import Path                    | Agent Type           |
 * |------------|--------------------------------|----------------------|
 * | Claude     | `@artinet/cruiser/claude`      | {@link ClaudeAgent}  |
 * | LangChain  | `@artinet/cruiser/langchain`   | {@link ReactAgent}   |
 * | Mastra     | `@artinet/cruiser/mastra`      | {@link MastraAgent}  |
 * | OpenAI     | `@artinet/cruiser/openai`      | {@link OpenAIAgent}  |
 * | Strands    | `@artinet/cruiser/strands`     | {@link StrandsAgent} |
 *
 * ## Quick Start
 *
 * ```typescript
 * import { park } from "@artinet/cruiser/openai";
 * import { Agent } from "@openai/agents";
 * import { serve } from "@artinet/sdk";
 *
 * const myAgent = new Agent({ name: "helper", instructions: "Be helpful" });
 * const artinetAgent = await park(myAgent, { name: "My Helper" });
 *
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * ## Architecture
 *
 * Each adapter implements the {@link Park} interface from `./corsair.ts`:
 * - Converts framework-specific agent to {@link sdk.Agent | A2A-compliant agent}
 * - Maps agent tools/capabilities to {@link sdk.A2A.AgentSkill | A2A skills}
 * - Handles message format conversion between protocols
 * - Preserves streaming and async execution patterns
 *
 * @see {@link https://artinet.io} Artinet Platform
 *
 * @experimental This library is under active development. APIs may change.
 */

// Re-export the core Park type for consumers who need to type their own adapters
export type { Park as Park } from "./corsair.js";
