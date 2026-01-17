<h1 align="center"><em>relay</em></h1>

Relay is an orc8 module for discovering and communicating with AI agents via the [@artinet/sdk](https://github.com/the-artinet-project/artinet-sdk).

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

### Quickstart (Discovery + Relay)

```typescript
import { cr8, A2A } from "@artinet/sdk";
import { Discover } from "orc8/relay";

// Create and start an Agent Server
const agentServer = cr8("test-agent").text("hello world!").server;

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
  taskQuery: { taskId: "task-123" },
});

const cancelled = await relay.cancelTask({
  agentId: "test-agent",
  taskId: { id: "task-123" },
});
```

### Search Agents

```typescript
const agents = await relay.searchAgents({ query: "calculator" });
```

### Configuration Options

Relay manages registered agents:

| Field         | Type                                   | Description                                                      | Default     |
| ------------- | -------------------------------------- | ---------------------------------------------------------------- | ----------- |
| `callerId`    | `string`                               | Unique identifier for this relay instance (prevents self-calls). | Required    |
| `abortSignal` | `AbortSignal`                          | Optional abort signal for outgoing requests.                     | `undefined` |
| `agents`      | `Map<string, Agent \| AgentMessenger>` | Optional initial registry.                                       | `new Map()` |

Discoverable relay adds optional scanning and sync:

| Field          | Type                     | Description                                              | Default                          |
| -------------- | ------------------------ | -------------------------------------------------------- | -------------------------------- |
| `callerId`     | `string`                 | Unique identifier for this relay instance.               | Required                         |
| `syncInterval` | `number`                 | Rescan interval in ms (omit to disable background sync). | `undefined`                      |
| `host`         | `string`                 | Hostname to scan.                                        | `"localhost"`                    |
| `startPort`    | `number`                 | Starting port to scan.                                   | `3000`                           |
| `endPort`      | `number`                 | Ending port to scan.                                     | `3100`                           |
| `threads`      | `number`                 | Concurrent scan threads.                                 | `250`                            |
| `headers`      | `Record<string, string>` | Optional headers for agent requests.                     | `undefined`                      |
| `fallbackPath` | `string`                 | Agent card fallback path.                                | `"/.well-known/agent-card.json"` |

#### Relay Methods

Interface methods exposed by the relay modules:

| Method            | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `registerAgent`   | Register a messenger or agent and cache its agent card.              |
| `deregisterAgent` | Remove an agent from the registry.                                   |
| `sendMessage`     | Send a message to a registered agent.                                |
| `getTask`         | Fetch a task from a registered agent.                                |
| `cancelTask`      | Cancel a task on a registered agent.                                 |
| `getAgentCard`    | Retrieve the agent card for a registered agent.                      |
| `searchAgents`    | Search agent cards by name, description, or skills.                  |
| `discoverAgents`  | Scan for agents and update the registry. (_Discoverable Relay Only_) |

## Requirements

- [Node.js](https://nodejs.org/en/download) ≥ 18.9.1
  - Recommended: 20 || ≥ 22

## License

Apache-2.0

## Source

- [`relay.ts`](../src/modules/relay/relay.ts) - Core relay implementation
- [`discover.ts`](../src/modules/relay/discover.ts) - Discovery utilities and DiscoverableRelay

## References

- [@artinet/sdk](https://github.com/the-artinet-project/sdk)
- [artinet](https://artinet.io)
