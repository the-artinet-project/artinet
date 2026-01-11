<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/cruiser"><img src="https://img.shields.io/npm/v/@artinet/cruiser?color=black" alt="Version"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://reddit.com/r/theartinet"><img src="https://img.shields.io/reddit/subreddit-subscribers/theartinet?label=reddit&style=flat&color=black" alt="Subreddit"></a>
<a href="https://snyk.io/test/npm/@artinet/cruiser"><img src="https://snyk.io/test/npm/@artinet/cruiser/badge.svg" alt="Known Vulnerabilities"></a>
</p>

<h1 align="center"><em>cruiser</em></h1>

<p align="center">
Universal adapters for multi-agent interoperability via the <strong>Agent2Agent (A2A) Protocol</strong>.
</p>

> ⚠️ **Experimental**: This library is under active development. APIs may change between versions.

## Overview

**Cruiser** provides "park" adapters that bridge popular AI agent frameworks to the [Agent2Agent (A2A) Protocol](https://github.com/google-a2a/A2A), enabling seamless multi-agent communication through the [`@artinet/sdk`](https://www.npmjs.com/package/@artinet/sdk).

### Supported Frameworks

| Framework            | Import Path                  | Status    |
| -------------------- | ---------------------------- | --------- |
| **OpenAI Agents**    | `@artinet/cruiser/openai`    | ✅ Stable |
| **Mastra**           | `@artinet/cruiser/mastra`    | ✅ Stable |
| **Claude Agent SDK** | `@artinet/cruiser/claude`    | ✅ Stable |
| **LangChain**        | `@artinet/cruiser/langchain` | ✅ Stable |
| **Strands (AWS)**    | `@artinet/cruiser/strands`   | ✅ Stable |

## Installation

```bash
npm install @artinet/cruiser @artinet/sdk
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
```

## Quick Start

### Single Agent

```typescript
import { Agent } from "@openai/agents";
import { park } from "@artinet/cruiser/openai";
import { serve } from "@artinet/sdk";

// 1. Create your agent
const agent = new Agent({
  name: "assistant",
  instructions: "You are a helpful assistant",
});

// 2. Park it into the A2A ecosystem
const artinetAgent = await park(agent, { name: "My Assistant" });

// 3. Deploy
serve({ agent: artinetAgent, port: 3000 });
```

### Multi-Agent System

Create interoperable agents from different frameworks:

```typescript
import { Agent as OpenAIAgent } from "@openai/agents";
import { Agent as MastraAgent } from "@mastra/core/agent";
import { park as parkOpenAI } from "@artinet/cruiser/openai";
import { park as parkMastra } from "@artinet/cruiser/mastra";
import { serve, A2AClient } from "@artinet/sdk";

// Park agents from different frameworks
const researcher = await parkOpenAI(
  new OpenAIAgent({ name: "researcher", instructions: "Research topics" }),
  { name: "Researcher" }
);

const writer = await parkMastra(
  new MastraAgent({ name: "writer", instructions: "Write content", model }),
  { name: "Writer" }
);

// Deploy on different ports
serve({ agent: researcher, port: 3001 });
serve({ agent: writer, port: 3002 });

// Agents can now communicate via A2A protocol
const client = new A2AClient("http://localhost:3001");
const result = await client.sendMessage({
  message: {
    role: "user",
    parts: [{ kind: "text", text: "Research AI trends" }],
  },
});
```

## API Reference

### `park(agent, card?, options?)`

Each adapter exports a `park` function with the same signature:

| Parameter | Type               | Description                         |
| --------- | ------------------ | ----------------------------------- |
| `agent`   | Framework-specific | The agent instance to park          |
| `card`    | `AgentCardParams`  | Optional A2A identity configuration |
| `options` | Framework-specific | Optional execution options          |

**Returns**: `Promise<sdk.Agent>` - An A2A-compatible agent

### Example with Full Configuration

```typescript
import { park } from "@artinet/cruiser/openai";

const artinetAgent = await park(
  myAgent,
  {
    name: "Production Assistant",
    description: "Enterprise-grade AI assistant",
    skills: [
      { id: "search", name: "Web Search", description: "Search the internet" },
      { id: "code", name: "Code Generation", description: "Write code" },
    ],
  },
  {
    maxTurns: 10,
    signal: abortController.signal,
  }
);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    @artinet/cruiser                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ OpenAI  │ │ Mastra  │ │ Claude  │ │LangChain│ │ Strands│ │
│  │  park   │ │  park   │ │  park   │ │  park   │ │  park  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │
│       │           │           │           │          │       │
│       └───────────┴───────────┴───────────┴──────────┘       │
│                              │                               │
│                              ▼                               │
│                    Unified Park Interface                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      @artinet/sdk                            │
│               A2A Protocol Implementation                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent2Agent Network                        │
│              (Multi-Agent Communication)                     │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

- [Node.js](https://nodejs.org/) ≥ 18.9.1 (Recommended: 20 or ≥ 22)

## Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Please open an issue or submit a Pull Request on [GitHub](https://github.com/the-artinet-project/artinet).

Ensure code adheres to the project style and passes linting (`npm run lint`) and tests (`npm test`).

## License

This project is licensed under Apache License 2.0.

See the [`LICENSE`](./LICENSE) for details.

## Join the Community

- **Reddit:** [r/theartinet](https://www.reddit.com/r/theartinet/)
- **Discord:** [artinet channel](https://discord.gg/DaxzSchmmX)

---
