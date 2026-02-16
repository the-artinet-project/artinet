/**
 * @fileoverview Artinet Cruiser - Agent Framework Adapters
 *
 * @module @artinet/cruiser
 * @version 0.1.0
 * @license Apache-2.0
 *
 * @description
 * Cruiser provides universal adapters ("docks") that bridge popular AI agent
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
 * | OpenClaw   | `@artinet/cruiser/openclaw`    | {@link OpenClawAgent}|
 * | OpenAI     | `@artinet/cruiser/openai`      | {@link OpenAIAgent}  |
 * | Pi Agent   | `@artinet/cruiser/pi-agent-core`| {@link PiAgentCoreAgent} |
 * | Strands    | `@artinet/cruiser/strands`     | {@link StrandsAgent} |
 *
 * ## Quick Start
 *
 * ```typescript
 * import { dock } from "@artinet/cruiser/openai";
 * import { Agent } from "@openai/agents";
 * import { serve } from "@artinet/sdk";
 *
 * const myAgent = new Agent({ name: "helper", instructions: "Be helpful" });
 * const artinetAgent = await dock(myAgent, { name: "My Helper" });
 *
 * serve({ agent: artinetAgent, port: 3000 });
 * ```
 *
 * ## Architecture
 *
 * Each adapter implements the {@link Dock} interface from `./corsair.ts`:
 * - Converts framework-specific agent to {@link sdk.Agent | A2A-compliant agent}
 * - Maps agent tools/capabilities to {@link sdk.A2A.AgentSkill | A2A skills}
 * - Handles message format conversion between protocols
 * - Preserves streaming and async execution patterns
 *
 * @see {@link https://artinet.io} Artinet Platform
 *
 * @experimental This library is under active development. APIs may change.
 */

// Re-export the core Dock type for consumers who need to type their own adapters
export type { Dock, Park } from "./corsair.js";
