/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import { AgentCardSchema } from "@artinet/sdk";
import { ServiceSchema } from "@artinet/types";

/**
 * Group definition
 *
 * Represents a flexible organizational unit that an agent can belong to.
 * Groups can represent teams, projects, clusters, departments, or any arbitrary
 * organizational structure.
 *
 * @example
 * // Simple team group
 * { id: "team:backend", properties: { role: "lead", tier: "senior" } }
 *
 * @example
 * // Project group
 * { id: "project:api-v2", properties: { status: "active", priority: 1 } }
 *
 * @example
 * // Cluster group
 * { id: "cluster:production-us-east", properties: { region: "us-east-1" } }
 */
export const GroupSchema = z.object({
  id: z
    .string()
    .describe("Group identifier (e.g., 'team:backend', 'project:api-v2')"),
  properties: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional properties of the group (e.g., role, priority, status)"
    ),
});
export type Group = z.infer<typeof GroupSchema>;

/**
 * Agent definition schema
 *
 * The core specification for an Artinet agent, defining its identity, capabilities,
 * organizational membership, and behavior. This schema is designed to be portable
 * and can be serialized in agent.md files with YAML frontmatter.
 *
 * @example
 * ```yaml
 * ---
 * id: backend-architect
 * name: Backend System Architect
 * description: Design RESTful APIs and microservice architectures
 * model: openai/gpt-4
 * version: "1.0.0"
 * toolIds:
 *   - filesystem
 *   - database-analyzer
 * groupIds:
 *   - team:backend
 *   - project:api-v2
 * agentIds:
 *   - database-specialist
 *   - security-auditor
 * instructions: |
 *   You are a backend system architect specializing in scalable API design...
 * ---
 * ```
 */
export const AgentDefinitionSchema = AgentCardSchema.partial({
  protocolVersion: true,
  url: true,
  capabilities: true,
  defaultInputModes: true,
  defaultOutputModes: true,
}).extend({
  /**
   * Optional agent ID - will be generated if not provided
   *
   * Use kebab-case for consistency (e.g., 'backend-architect', 'code-reviewer')
   */
  id: z.string().optional().describe("Unique agent identifier"),

  /**
   * Optional model specification
   *
   * Specifies the LLM model to use for this agent.
   *
   * @example "openai/gpt-4o-mini"
   * @example "anthropic/claude-3-opus-20241022"
   * @example "deepseek-ai/DeepSeek-R1"
   */
  modelId: z.string().optional().describe("Model identifier"),

  /**
   * Tool IDs that this agent can use
   *
   * A flexible list of tool identifiers that reference MCP servers, in-memory
   * functions, or any other tool providers available in the runtime environment.
   * Tools are resolved by the agent runtime based on these IDs.
   *
   * @example ["filesystem", "web-search", "code-analyzer"]
   * @example ["mcp-server-git", "mcp-server-postgres", "custom-api-client"]
   */
  toolIds: z
    .array(z.string())
    .default([])
    .describe("List of tool ids that this agent can use"),

  /**
   * Agent IDs that this agent can call
   *
   * Explicitly defines which other agents this agent has permission to invoke.
   * These could be local agent instances, remote agent servers, or any agent
   * accessible in the runtime environment. This provides explicit access control
   * separate from group membership.
   *
   * @example ["database-specialist", "security-auditor", "code-reviewer"]
   * @example ["agent://team-lead", "https://agents.example.com/research"]
   */
  agentIds: z
    .array(z.string())
    .optional()
    .describe("The agent ids that this agent can call"),

  /**
   * Groups that this agent belongs to
   *
   * Defines organizational membership for discovery, coordination, and management.
   * Groups can represent teams, projects, clusters, departments, or any arbitrary
   * organizational structure. Supports both simple string IDs and rich objects
   * with properties.
   *
   * @example
   * // Simple string references
   * ["team:backend", "project:api-v2", "cluster:production"]
   *
   * @example
   * // Rich objects with properties
   * [
   *   { id: "team:backend", properties: { role: "lead", tier: "senior" } },
   *   { id: "project:api-v2", properties: { status: "active", priority: 1 } }
   * ]
   */
  groupIds: z
    .array(z.union([z.string(), GroupSchema]))
    .optional()
    .default([])
    .describe("List of group ids that this agent belongs to"),

  /**
   * System instructions for the agent
   *
   * The core prompt that defines the agent's behavior, expertise, methodology,
   * and output format. This is typically provided in the markdown body of an
   * agent.md file and defines the agent's persona and capabilities.
   *
   * @example
   * ```
   * You are a backend system architect specializing in scalable API design.
   *
   * ## Focus Areas
   * - RESTful API design with proper versioning
   * - Microservice boundaries and communication patterns
   * - Database schema design and optimization
   *
   * ## Methodology
   * 1. Analyze requirements and constraints
   * 2. Design contract-first APIs
   * 3. Consider scalability from day one
   * ```
   */
  instructions: z.string().describe("System prompt for the agent"),
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

/**
 * Agent configuration schema
 *
 * Extends AgentDefinition with deployment-specific configuration including
 * server connections and runtime metadata. This schema represents the full
 * configuration needed to instantiate and run an agent in a specific environment.
 *
 * Use this when:
 * - Deploying an agent to a runtime environment
 * - Connecting to specific MCP or A2A servers
 * - Adding environment-specific metadata
 *
 * @example
 * ```typescript
 * const config: AgentConfiguration = {
 *   // AgentDefinition fields
 *   id: "backend-architect",
 *   name: "Backend System Architect",
 *   description: "Design RESTful APIs and microservice architectures",
 *   model: "openai/gpt-4",
 *   toolIds: ["filesystem", "database-analyzer"],
 *   instructions: "You are a backend system architect...",
 *
 *   // Configuration-specific fields
 *   servers: [
 *     {
 *       type: "mcp",
 *       id: "filesystem",
 *       url: "http://localhost:3000/mcp/filesystem"
 *     },
 *     {
 *       type: "a2a",
 *       id: "database-specialist",
 *       url: "https://agents.example.com/database-specialist"
 *     }
 *   ],
 *   metadata: {
 *     environment: "production",
 *     region: "us-east-1",
 *     version: "1.2.3"
 *   }
 * }
 * ```
 */
export const AgentConfigurationSchema = AgentDefinitionSchema.extend({
  /**
   * Service connections for this agent
   *
   * Defines the actual service endpoints for MCP tool services and A2A agent services
   * that this agent will connect to at runtime. Each service must have a type,
   * unique ID, and connection URL.
   *
   * @example
   * [
   *   { type: "mcp", id: "filesystem", url: "http://localhost:3000/mcp/fs" },
   *   { type: "a2a", id: "researcher", url: "https://agents.example.com/research" }
   *   { type: "a2a", uri: "local-agent-id", parameters: { name: "John Doe" } }
   * ]
   */
  services: z
    .array(ServiceSchema)
    .default([])
    .describe("List of MCP or A2A services"),

  /**
   * Runtime metadata for the agent
   *
   * Arbitrary key-value pairs for environment-specific configuration, tracking,
   * or runtime behavior customization. Common uses include environment tags,
   * version tracking, deployment information, or feature flags.
   *
   * @example
   * {
   *   environment: "production",
   *   region: "us-east-1",
   *   deployedBy: "ci-pipeline",
   *   deployedAt: "2025-01-15T10:30:00Z",
   *   version: "1.2.3"
   * }
   */
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe("Runtime metadata for environment-specific configuration"),
});
export type AgentConfiguration = z.infer<typeof AgentConfigurationSchema>;
