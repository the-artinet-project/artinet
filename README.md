<p align="center">
  <a href="https://artinet.io">
    <img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website">
  </a>
  <a href="https://discord.gg/DaxzSchmmX">
    <img src="https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat&color=black" alt="Discord">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License">
    </a>
    <a href="https://reddit.com/r/artinet">
      <img src="https://img.shields.io/reddit/subreddit-subscribers/theartinet?label=reddit&style=flat&color=black" alt="Subreddit">
    </a>
</p>

# Artinet Platform

Build, deploy, and orchestrate AI agents that communicate across frameworks using standard protocols from the [Agentic AI Foundation](https://aaif.io/).

## Packages

| Package                                   | Description                                                  | npm                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@artinet/sdk`](./sdk)                   | Core SDK for building A2A agents with client/server support  | [![npm](https://img.shields.io/npm/v/@artinet/sdk?color=black&label=npm)](https://www.npmjs.com/package/@artinet/sdk)                                                                                                                                                         |
| [`@artinet/fleet`](./fleet)               | Server framework for hosting A2A agents with MCP integration | [![npm](https://img.shields.io/npm/v/@artinet/fleet?color=black&label=npm)](https://www.npmjs.com/package/@artinet/fleet)                                                                                                                                                     |
| [`easy-a2a`](./easy)                      | Turn any OpenAI-compatible API into an A2A agent             | [![npm](https://img.shields.io/npm/v/easy-a2a?color=black&label=npm)](https://www.npmjs.com/package/easy-a2a)                                                                                                                                                                 |
| [`@artinet/agent-relay`](./relay)         | Agent discovery and multi-agent communication                | [![npm](https://img.shields.io/npm/v/@artinet/agent-relay?color=black&label=npm)](https://www.npmjs.com/package/@artinet/agent-relay)                                                                                                                                         |
| [`orc8`](./orc8)                          | Dynamic orchestration for A2A agents with MCP tool support   | [![npm](https://img.shields.io/npm/v/orc8?color=black&label=npm)](https://www.npmjs.com/package/orc8)                                                                                                                                                                         |
| [`@artinet/symphony`](./symphony)         | Interactive CLI for managing multi-agent systems             | [![npm](https://img.shields.io/npm/v/@artinet/symphony?color=black&label=npm)](https://www.npmjs.com/package/@artinet/symphony)                                                                                                                                               |
| [`@artinet/create-agent`](./create-agent) | CLI tool to scaffold A2A agent projects                      | [![npm](https://img.shields.io/npm/v/@artinet/create-agent?color=black&label=npm)](https://www.npmjs.com/package/@artinet/create-agent)                                                                                                                                       |
| [`@artinet/ask`](./ask)                   | Lightweight CLI chat client for A2A servers                  | [![npm](https://img.shields.io/npm/v/@artinet/ask?color=black&label=npm)](https://www.npmjs.com/package/@artinet/ask)                                                                                                                                                         |
| [`@artinet/loader`](./loader)             | Load agent definitions from files                            | [![npm](https://img.shields.io/npm/v/@artinet/loader?color=black&label=npm)](https://www.npmjs.com/package/@artinet/loader)                                                                                                                                                   |
| [`agent-def`](./agent-def)                | Standardized agent definition schema                         | [![npm](https://img.shields.io/npm/v/agent-def?color=black&label=npm)](https://www.npmjs.com/package/agent-def)                                                                                                                                                               |
| [`@artinet/types`](./types)               | Shared TypeScript types                                      | [![npm](https://img.shields.io/npm/v/@artinet/types?color=black&label=npm)](https://www.npmjs.com/package/@artinet/types)                                                                                                                                                     |
| [`mcp`](./mcp)                            | MCP servers (bash, agent-relay)                              | [![npm](https://img.shields.io/npm/v/@artinet/bash-mcp?color=black&label=npm)](https://www.npmjs.com/package/@artinet/bash-mcp) [![npm](https://img.shields.io/npm/v/@artinet/agent-relay-mcp?color=black&label=npm)](https://www.npmjs.com/package/@artinet/agent-relay-mcp) |

## Quick Start

### Create an Agent

```bash
npx @artinet/create-agent@latest
```

### Or Build One Manually

**Server:**

```typescript
import { cr8 } from "@artinet/sdk";

const { app } = cr8("My Agent")
  .text(({ content }) => `You said: ${content}`)
  .server.start(3000);
```

**Client:**

```typescript
import { A2AClient } from "@artinet/sdk";

const client = new A2AClient("http://localhost:3000/a2a");

for await (const update of client.sendStreamingMessage("Hello!")) {
  console.log(update);
}
```

### The Easy Way

```typescript
import a2a from "easy-a2a";

const agent = a2a({ apiKey: "your-api-key" })
  .ai("You are a helpful assistant.")
  .createAgent({ agentCard: "MyAgent" });

await agent.sendMessage("Hello!");
```

### Deploy with Fleet

```typescript
import { fleet } from "@artinet/fleet/express";
import { A2AClient } from "@artinet/sdk";

const swarm = await fleet().ship([
  {
    config: {
      name: "my-agent",
      ...
    },
  },
]);

swarm.launch(3000);

const client = new A2AClient("http://localhost:3000/agentId/my-agent");
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Artinet Platform                         │
├─────────────────────────────────────────────────────────────────┤
│  CLI Tools                                                      │
│  ├── create-agent         → Scaffold new projects               │
│  ├── symphony             → Multi-agent management              │
│  └── ask                  → Chat with agents                    │
├─────────────────────────────────────────────────────────────────┤
│  Server Frameworks                                              │
│  ├── fleet                → Deploy & host agents                │
│  └── sdk                  → Build A2A servers                   │
├─────────────────────────────────────────────────────────────────┤
│  Agent Building                                                 │
│  ├── easy-a2a             → Quick agent creation                │
│  ├── orc8                 → Orchestration + MCP tools           │
│  └── relay                → Agent discovery                     │
├─────────────────────────────────────────────────────────────────┤
│  Foundation                                                     │
│  ├── agent-def            → Agent definition schema             │
│  ├── loader               → Load definitions from files         │
│  ├── types                → Shared types                        │
│  └── mcp/                 → MCP servers (bash, relay)           │
└─────────────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js ≥ 18.9.1 (Recommended: 20 or ≥ 22)

## License

Apache-2.0

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/the-artinet-project/artinet).

## Links

- 🌐 [Website](https://artinet.io)
- 👥 [Reddit](https://www.reddit.com/r/artinet/)
- 💬 [Discord](https://discord.gg/DaxzSchmmX)
