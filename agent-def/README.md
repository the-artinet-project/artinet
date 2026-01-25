<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/agent-def"><img src="https://img.shields.io/npm/v/agent-def?color=black" alt="Version"></a>
<a href="https://www.npmjs.com/package/agent-def"><img src="https://img.shields.io/npm/dt/agent-def?color=black" alt="Downloads"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://snyk.io/test/npm/agent-def"><img src="https://snyk.io/test/npm/agent-def/badge.svg" alt="Known Vulnerabilities"></a>
</p>

<h1 align="center"><em>agent-def</em></h1>

A standardized, portable definition format for collaborative AI agents.

## Overview

`agent-def` provides TypeScript/Zod schemas for defining agent configurations that can be validated, serialized as YAML front-matter (agent.md files), and deployed across environments.

**Core schemas:**

- `AgentDefinition` - Identity, model, tools, groups, and instructions
- `AgentConfiguration` - Extends definition with services and runtime metadata
- `Group` - Organizational units (teams, projects, clusters)

**Identity:** Agent, tool, and group IDs can be simple strings (e.g., `backend-architect`) or more complex structures ( e.g. DIDs (Decentralized Identifiers), etc).

## Installation

```bash
npm install agent-def
```

## Usage

```typescript
import { AgentDefinitionSchema, AgentConfigurationSchema } from 'agent-def';

// Parse an agent definition
const agentDef = AgentDefinitionSchema.parse({
    id: 'backend-architect',
    name: 'Backend System Architect',
    modelId: 'openai/gpt-4',
    toolUris: ['filesystem', 'database-analyzer'],
    groupIds: ['team:backend', 'project:api-v2'],
    agentUris: ['database-specialist'],
    instructions: 'You are a backend system architect...',
});

// Extend with deployment configuration
const agentConfig = AgentConfigurationSchema.parse({
    ...agentDef,
    services: [
        {
            type: 'mcp',
            uri: 'filesystem',
            url: 'http://localhost:3000/mcp/fs',
            info: {
                implementation: {
                    version: '0.0.1',
                    name: `filesystem-mcp`,
                    serverCapabilities: {},
                },
            },
        },
        {
            type: 'a2a',
            uri: 'database-specialist',
            url: 'https://agents.example.com/db',
            info: {
                protocolVersion: '0.3.0',
                name: 'database-specialist',
                ...
            },
        },
    ],
    metadata: { environment: 'production', region: 'us-east-1' },
});
```

## agent.md Format

Store definitions as markdown files with YAML front-matter:

```markdown
---
uri: backend-architect
name: Backend System Architect
modelId: openai/gpt-4
toolUris: [filesystem, database-analyzer]
groupIds: [team:backend, project:api-v2]
agentUris: [database-specialist, security-auditor]
---

You are a backend system architect specializing in scalable API design.
Focus on RESTful patterns, microservice boundaries, and database optimization.
```

## Development

```bash
# Build the library
npm run build

# Generate JSON Schema
npm run generate:schema

# Run tests
npm test

# Lint code
npm run lint
```

## Future Direction

**The goal is to eventually merge more definitions (e.g. [Project Nanda's](https://github.com/projnanda/agentfacts-format) Agent Facts, [AGNTCY](https://github.com/agntcy/identity) definitions, [AI Card](https://github.com/Agent-Card/ai-card)) into a unified spec**. This consolidation will enable consistent agent definitions, discovery, sharing, and simplified tooling across the artinet.

## Contributing

We welcome contributions from the community! Whether you want to:

- Enhance the agent definition standard with new capabilities
- Improve documentation and examples
- Fix bugs or add features
- Share your use cases and patterns

Please read our [Contributing Guide](CONTRIBUTING.md) to get started. All contributors are recognized and appreciated.

## License

Apache-2.0

## Links

- [GitHub Repository](https://github.com/the-artinet-project/artinet)
- [Issue Tracker](https://github.com/the-artinet-project/artinet/issues)
- [Contributing Guide](CONTRIBUTING.md)
