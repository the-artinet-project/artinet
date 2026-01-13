<p align="center"> <a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a> <a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a> <a href="https://reddit.com/r/theartinet"><img src="https://img.shields.io/reddit/subreddit-subscribers/theartinet?label=reddit&style=flat&color=black" alt="Subreddit"></a>
</p>

<h1 align="center"><em>artinet</em></h1>

Build, deploy, and orchestrate AI agents that communicate across frameworks using standard protocols from the [Agentic AI Foundation](https://aaif.io/).

## Packages

| Package                                                              | Description                                                  | npm                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@artinet/sdk`](https://github.com/the-artinet-project/artinet-sdk) | Core SDK for building A2A agents with client/server support  | [![npm](https://img.shields.io/npm/v/@artinet/sdk?color=black&label=npm)](https://www.npmjs.com/package/@artinet/sdk)                                                                                                                                                         |
| [`cruiser`](./cruiser/)                                              | Core SDK for building A2A agents with client/server support  | [![npm](https://img.shields.io/npm/v/@artinet/cruiser?color=black&label=npm)](https://www.npmjs.com/package/@artinet/sdk)                                                                                                                                                     |
| [`fleet`](./fleet)                                                   | Server framework for hosting A2A agents with MCP integration | [![npm](https://img.shields.io/npm/v/@artinet/fleet?color=black&label=npm)](https://www.npmjs.com/package/@artinet/fleet)                                                                                                                                                     |
| [`agent-relay`](./relay)                                             | Agent discovery and multi-agent communication                | [![npm](https://img.shields.io/npm/v/@artinet/agent-relay?color=black&label=npm)](https://www.npmjs.com/package/@artinet/agent-relay)                                                                                                                                         |
| [`orc8`](./orc8)                                                     | Dynamic orchestration for A2A agents with MCP tool support   | [![npm](https://img.shields.io/npm/v/orc8?color=black&label=npm)](https://www.npmjs.com/package/orc8)                                                                                                                                                                         |
| [`symphony`](./symphony)                                             | Interactive CLI for managing multi-agent systems             | [![npm](https://img.shields.io/npm/v/@artinet/symphony?color=black&label=npm)](https://www.npmjs.com/package/@artinet/symphony)                                                                                                                                               |
| [`create-agent`](./create-agent)                                     | CLI tool to scaffold A2A agent projects                      | [![npm](https://img.shields.io/npm/v/@artinet/create-agent?color=black&label=npm)](https://www.npmjs.com/package/@artinet/create-agent)                                                                                                                                       |
| [`ask`](./ask)                                                       | Lightweight CLI chat client for A2A servers                  | [![npm](https://img.shields.io/npm/v/@artinet/ask?color=black&label=npm)](https://www.npmjs.com/package/@artinet/ask)                                                                                                                                                         |
| [`load`](./loader)                                                   | Load agent definitions from files                            | [![npm](https://img.shields.io/npm/v/@artinet/loader?color=black&label=npm)](https://www.npmjs.com/package/@artinet/loader)                                                                                                                                                   |
| [`agent-def`](./agent-def)                                           | Standardized agent definition schema                         | [![npm](https://img.shields.io/npm/v/agent-def?color=black&label=npm)](https://www.npmjs.com/package/agent-def)                                                                                                                                                               |
| [`types`](https://github.com/the-artinet-project/types)              | Shared TypeScript types                                      | [![npm](https://img.shields.io/npm/v/@artinet/types?color=black&label=npm)](https://www.npmjs.com/package/@artinet/types)                                                                                                                                                     |
| [`mcp`](./mcp)                                                       | MCP servers (bash, agent-relay)                              | [![npm](https://img.shields.io/npm/v/@artinet/bash-mcp?color=black&label=npm)](https://www.npmjs.com/package/@artinet/bash-mcp) [![npm](https://img.shields.io/npm/v/@artinet/agent-relay-mcp?color=black&label=npm)](https://www.npmjs.com/package/@artinet/agent-relay-mcp) |

## Quick Start

### [Create an Agent](./create-agent/)

```bash
npx @artinet/create-agent@latest
```

### [Own every line](https://github.com/the-artinet-project/artinet-sdk)

**Server:**

Serve intelligence in a couple lines. `cr8` lets you quickly scaffold an AI agent without the headache.

```typescript
import { cr8 } from "@artinet/sdk";

const { app } = cr8("My Agent")
  .text(({ content }) => `You said: ${content}`)
  .server.start(3000);
```

**Messenger:**

Talk to any agent. Messenger is an A2A protocol client, purpose built for multi-agent servers.

```typescript
import { createMessenger, AgentMessenger } from "@artinet/sdk";

const messenger: AgentMessenger = createMessenger({
  baseUrl: "http://localhost:3000/a2a",
});

for await (const update of messenger.sendMessageStream("Hello!")) {
  console.log(update);
}
```

### [One protocol, Every framework](./cruiser/)

Cruiser docks agents from any framework onto artinet. Letting your OpenAI, Claude, and LangChain agents collaborate.

```typescript
import { Agent } from "@openai/agents";
import { dock } from "@artinet/cruiser/openai";
import { serve } from "@artinet/sdk";

const openaiAgent = new Agent({
  name: "assistant",
  instructions: "You are a helpful assistant",
});

const agent = await dock(agent, { name: "My Assistant" });

await agent.sendMessage("Hello, World!");
```

### [Ship agents, not infrastructure.](./fleet/)

Fleet is a lightweight server that deploys A2A AI agents, so you can focus on intelligence, not plumbing.

```typescript
import { fleet } from "@artinet/fleet/express";
import { createMessenger, AgentMessenger } from "@artinet/sdk";

const flotilla = await fleet().ship([
  {
    config: {
      uri: "my-agent",
      ...
    },
  },
]);

flotilla.launch(3000);

const messenger: AgentMessenger = await createMessenger({ baseUrl: "http://localhost:3000/agentId/my-agent" });

await messenger.sendMessage("Hello, World!");
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
│  ├── orc8                 → Orchestration + MCP tools           │
│  ├── cruiser              → Framework adapter (Langchain, etc)  │
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
- 👥 [Reddit](https://www.reddit.com/r/theartinet/)
- 💬 [Discord](https://discord.gg/DaxzSchmmX)
