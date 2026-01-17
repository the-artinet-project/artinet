<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/agent-relay"><img src="https://img.shields.io/npm/v/@artinet/agent-relay?color=black" alt="Version"></a>
<a href="https://www.npmjs.com/package/@artinet/agent-relay"><img src="https://img.shields.io/npm/dt/@artinet/agent-relay?color=black" alt="Downloads"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://snyk.io/test/npm/@artinet/agent-relay"><img src="https://snyk.io/test/npm/@artinet/agent-relay/badge.svg" alt="Known Vulnerabilities"></a>
</p>

<h1 align="center"><em>agent relay</em></h1>

> Agent Relay has been migrated to [orc8](https://www.npmjs.com/package/orc8).
> For the time being this package will be maintained as a re-export but will eventually be deprecated.
> Migrating to `orc8` is highly recommended.

Relay is an [orc8](https://github.com/the-artinet-project/artinet) module for discovering and communicating with AI agents via the [@artinet/sdk](https://github.com/the-artinet-project/artinet-sdk).

## Features

- **Registration**: Register A2A agents or clients directly
- **Automatic Discovery**: Scan ports and keep a live registry of reachable agents
- **Message Relay**: Send messages and stream responses with full task context
- **Task Management**: Get tasks and cancel running work
- **Agent Search**: Query agent cards by name, description, or skills

## Installation

```bash
npm install orc8
```

Port-based discovery requires `portscanner` (peer dependency):

```bash
npm install portscanner
```

## Usage

### Imports

```typescript
import { Relay, Discover } from "orc8/relay";
```

### Configuration Options

Relay manages registered agents:

```typescript
import type { Service, AgentMessenger } from "@artinet/sdk";

interface RelayConfig {
  callerId: string; // Unique identifier for this relay instance (prevents self-calls)
  abortSignal?: AbortSignal; // Optional abort signal for outgoing requests
  agents?: Map<string, Service | AgentMessenger>; // Optional initial registry
}
```

Discoverable relay adds optional scanning and sync:

```typescript
interface DiscoverConfig {
  callerId: string;
  syncInterval?: number; // Rescan interval in ms (omit to disable background sync)
  host?: string; // Default: "localhost"
  startPort?: number; // Default: 3000
  endPort?: number; // Default: 3100
  threads?: number; // Default: 250
  headers?: Record<string, string>; // Optional headers for agent requests
  fallbackPath?: string; // Default: "/.well-known/agent-card.json"
}
```

### Quickstart (Discovery + Relay)

```typescript
import { cr8, A2A } from "@artinet/sdk";
import { Discover } from "orc8/relay";

// Create and start an Agent Server
const agentServer = cr8({
  name: "test-agent",
  skills: [
    {
      name: "calculator",
    },
  ],
}).text("hello world!").server;

const server = agentServer.app.listen(3001, () => {
  console.log("test-agent started on port 3001");
});

// Create a discoverable relay
const relay = await Discover.create({
  callerId: "caller-id",
  host: "localhost",
  startPort: 3000,
  endPort: 3100,
  syncInterval: 2500,
});

// Send a message to an agent
const response: A2A.SendMessageSuccessResult = await relay.sendMessage({
  agentId: "test-agent",
  messageSendParams: {
    message: {
      role: "user",
      kind: "message",
      parts: [{ kind: "text", text: "Hello!" }],
      messageId: "msg-123",
    },
  },
});

// Clean up when done
await relay.stop();
server.close();
```

### Manual Registration

```typescript
import { createMessenger } from "@artinet/sdk";
import { Relay } from "orc8/relay";

const relay = await Relay.create({ callerId: "caller-id" });

const messenger = await createMessenger({
  baseUrl: "http://localhost:3001",
  fallbackPath: "/.well-known/agent-card.json",
});

await relay.registerAgent(messenger);
```

### Task Management

```typescript
const task = await relay.getTask({
  agentId: "test-agent",
  taskQuery: { taskId: "task-123", metadata: {}, historyLength: undefined },
});

const cancelled = await relay.cancelTask({
  agentId: "test-agent",
  taskId: { id: "task-123", metadata: {} },
});
```

### Search Agents

```typescript
const agents = await relay.searchAgents({ query: "calculator" });
```

## Requirements

- [Node.js](https://nodejs.org/en/download) ≥ 18.9.1
  - Recommended: 20 || ≥ 22

## License

Apache-2.0

## References

- [artinet](https://artinet.io)
- [sdk](https://github.com/the-artinet-project/sdk)
