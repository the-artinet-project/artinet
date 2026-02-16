<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/cruiser"><img src="https://img.shields.io/npm/v/@artinet/cruiser?color=black" alt="Version"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://reddit.com/r/theartinet"><img src="https://img.shields.io/reddit/subreddit-subscribers/theartinet?label=reddit&style=flat&color=black" alt="Subreddit"></a>
<a href="https://snyk.io/test/npm/@artinet/cruiser"><img src="https://snyk.io/test/npm/@artinet/cruiser/badge.svg" alt="Known Vulnerabilities"></a>
</p>

<h1 align="center"><em>cruiser</em></h1>

<p align="center">
Universal adapters for multi-agent interoperability.
</p>

## Overview

**Cruiser** provides "dock" adapters that bridge popular AI agent frameworks to enable multi-agent communication through the [`@artinet/sdk`](https://www.npmjs.com/package/@artinet/sdk).

### Supported Frameworks

| Framework            | Import Path                  | Status  |
| -------------------- | ---------------------------- | ------- |
| **OpenAI Agents**    | `@artinet/cruiser/openai`    | Text ✅ |
| **Mastra**           | `@artinet/cruiser/mastra`    | Text ✅ |
| **Claude Agent SDK** | `@artinet/cruiser/claude`    | Text ✅ |
| **LangChain**        | `@artinet/cruiser/langchain` | Text ✅ |
| **Strands (AWS)**    | `@artinet/cruiser/strands`   | Text ✅ |
| **OpenClaw**         | `@artinet/cruiser/openclaw`  | Text ✅ |

## Installation

```bash
npm install @artinet/cruiser @artinet/sdk @modelcontextprotocol/sdk @a2a-js/sdk
```

Install your preferred agent framework:

```bash
# OpenAI Agents
npm install @openai/agents

# Mastra
npm install @mastra/core

# Claude Agent SDK
npm install @anthropic-ai/sdk @anthropic-ai/claude-agent-sdk

# LangChain
npm install langchain @langchain/core

# Strands (AWS)
npm install @strands-agents/sdk

# OpenClaw
# openclaw runs as a gateway service/CLI
# see: https://github.com/openclaw/openclaw
# Cruiser's OpenClaw dock uses the standard Gateway WebSocket protocol.
```

## Quick Start

### Single Agent

Create an agent from any of the supported frameworks and dock it onto artinet:

```typescript
import { Agent } from '@openai/agents';
import { dock } from '@artinet/cruiser/openai';
import { serve } from '@artinet/sdk';

// 1. Create your agent
const agent = new Agent({
    name: 'assistant',
    instructions: 'You are a helpful assistant',
});

// 2. Dock it onto artinet
const artinetAgent = await dock(agent, { name: 'My Assistant' });

// 3. Spin it up as an A2A compatible Server
serve({ agent: artinetAgent, port: 3000 });
```

### Multi-Agent Systems

> _Experimental_

Create interoperable multi-agent systems:

```typescript
import { serve, cr8 } from '@artinet/sdk';
import { dock as dockMastra } from '@artinet/cruiser/mastra';
import { dock as dockOpenAI } from '@artinet/cruiser/openai';
import { Agent as MastraAgent } from '@mastra/core/agent';
import { Agent as OpenAIAgent } from '@openai/agents';
import { MastraModel } from './mastra-model';

// Use agents from different frameworks
const researcher = await dockOpenAI(new OpenAIAgent({ name: 'researcher', instructions: 'Research topics' }), {
    name: 'Researcher',
});

const writer = await dockMastra(new MastraAgent({ name: 'writer', instructions: 'Write content', model }), {
    name: 'Writer',
});

// Chain them together
const agent = cr8('Orchestrator Agent')
    // The researcher will receive the incoming user message
    .sendMessage({ agent: researcher })
    // The results are passed to the writer with additional instructions
    .sendMessage({
        agent: writer,
        message: 'use the research results to create a publishable article',
    }).agent;

console.log(await agent.sendMessage('I want to learn about the Roman Empire.'));
```

- For more information on how to chain agent requests see the [artinet-sdk](https://github.com/the-artinet-project/artinet-sdk/blob/main/docs/create.md#agent-orchestration)

## API Reference

### `dock(agent, card?, options?)`

Each adapter exports a `dock` function with the same signature:

| Parameter | Type               | Description                |
| --------- | ------------------ | -------------------------- |
| `agent`   | Framework-specific | The agent instance to dock |
| `card`    | `AgentCardParams`  | Optional identity details  |
| `options` | Framework-specific | Optional execution options |

**Returns**: `Promise<Agent>` - An artinet-compatible agent

### Describe your agent

```typescript
import { dock } from '@artinet/cruiser/openai';

const artinetAgent = await dock(
    myAgent,
    {
        name: 'Production Assistant',
        description: 'Enterprise-grade AI assistant',
        skills: [
            { id: 'search', name: 'Web Search', description: 'Search the internet' },
            { id: 'code', name: 'Code Generation', description: 'Write code' },
        ],
    },
    {
        // Most adapters allow for framework specific options to be passed
        maxTurns: 10,
        signal: abortController.signal,
    },
);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    @artinet/cruiser                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ OpenAI  │ │ Mastra  │ │ Claude  │ │LangChain│ │ Strands│ │
│  │  dock   │ │  dock   │ │  dock   │ │  dock   │ │  dock  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │
│       │           │           │           │          │      │
│       └───────────┴───────────┴───────────┴──────────┘      │
│                              │                              │
│                              ▼                              │
│                       Unified Interface                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      @artinet/sdk                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         artinet                             │
│              (Multi-Agent Communication)                    │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

- [Node.js](https://nodejs.org/) ≥ 18.9.1 (Recommended: 20 or ≥ 22)

## Running Tests

```bash
npm test
```

## Contributor Guide

For dock implementation standards and integration best practices, see `AGENT.md`.

## Contributing

Additional dock functions are welcome! Please open an issue or submit a Pull Request on [GitHub](https://github.com/the-artinet-project/artinet).

Ensure code adheres to the project style and passes linting (`npm run lint`) and tests (`npm test`).

## License

This project is licensed under Apache License 2.0.

See the [`LICENSE`](./LICENSE) for details.

## Join the Community

- **Reddit:** [r/theartinet](https://www.reddit.com/r/theartinet/)
- **Discord:** [artinet channel](https://discord.gg/DaxzSchmmX)

---
