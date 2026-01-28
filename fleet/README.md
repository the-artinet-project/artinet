<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/fleet"><img src="https://img.shields.io/npm/v/@artinet/fleet?color=black" alt="Version"></a>
<a href="https://www.npmjs.com/package/@artinet/fleet"><img src="https://img.shields.io/npm/dt/@artinet/fleet?color=black" alt="Downloads"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://snyk.io/test/npm/@artinet/fleet"><img src="https://snyk.io/test/npm/@artinet/fleet/badge.svg" alt="Known Vulnerabilities"></a>
</p>
<h1 align="center"><em>fleet</em></h1>

Deploy AI agents on any infrastructure.

Fleet is a lightweight server framework for hosting agents with built-in orchestration, tool integration (MCP), and Agent2Agent (A2A) communication.

## Features

- **Multi-Framework Support** — Express and Hono adapters (with edge runtime compatibility on the way).
- **A2A Protocol Compliant** — Full JSON-RPC 2.0 implementation for agent interactions
- **MCP Integration** — Connect to Model Context Protocol servers for tool access
- **Pluggable Storage** — In-memory, SQLite, or custom storage backends
- **Custom Middleware** — Intercept and transform requests/responses
- **Multi-Tenant Ready** — Built-in user isolation for SaaS deployments

## Installation

```bash
npm install @artinet/fleet openai @modelcontextprotocol/sdk @a2a-js/sdk
```

**Requirements:** Node.js >= 18.9.1

## Quick Start

### 1. Launch a Fleet

Set an `OPENAI_API_KEY` in your environment variables, then start your server.

**Express:**

```bash
npm install express
```

```typescript
import { fleet } from '@artinet/fleet/express';

fleet().launch(3000);
```

**Hono:**

```bash
npm install hono
```

```typescript
import { fleet } from '@artinet/fleet/hono';

fleet().launch(3000);
```

That's it. You now have:

- `POST /deploy` — Deploy agents
- `POST /test` — Test agent deployments
- `GET /agentId/:id/.well-known/agent-card.json` — Agent metadata
- `POST /agentId/:id` — JSON-RPC agent interaction

### 2. Deploy an Agent

**Prelaunch (ship before launch):**

```typescript
import { fleet } from '@artinet/fleet/express';

const myFleet = await fleet().ship([
    {
        config: {
            uri: 'my-agent',
            name: 'My Agent',
            description: 'A helpful assistant',
            modelId: 'gpt-4o',
            instructions: 'You are a helpful assistant.',
            version: '1.0.0',
            skills: [],
            capabilities: {},
            defaultInputModes: ['text'],
            defaultOutputModes: ['text'],
            services: [],
        },
    },
]);

myFleet.launch(3000);
```

**Post Launch (ship to a running server):**

Use the ship command, it uses zod to verify agent configurations before sending them to fleet.

```typescript
import { ship } from '@artinet/fleet';

await ship('http://localhost:3000', {
    config: {
        uri: 'my-agent',
        name: 'My Agent',
        description: 'A helpful assistant',
        modelId: 'gpt-4o',
        instructions: 'You are a helpful assistant.',
        version: '1.0.0',
        skills: [],
        capabilities: {},
        defaultInputModes: ['text'],
        defaultOutputModes: ['text'],
        services: [],
    },
});
```

**With MCP Tools:**

```typescript
import { ship } from '@artinet/fleet';

await ship('http://localhost:3000', {
    config: {
        uri: 'tool-agent',
        name: 'Tool Agent',
        description: 'An agent with access to tools',
        modelId: 'gpt-4o',
        instructions: 'You are a helpful assistant with tool access.',
        version: '1.0.0',
        skills: [],
        capabilities: {},
        defaultInputModes: ['text'],
        defaultOutputModes: ['text'],
        services: [
            {
                type: 'mcp',
                uri: 'everything-server',
                info: {
                    implementation: {
                        version: '0.0.1',
                        name: 'everything',
                    },
                },
                arguments: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-everything@2025.11.25'],
                },
            },
        ],
    },
});
```

### 3. Talk to Your Agent

**Via curl:**

```bash
curl -X POST http://localhost:3000/agentId/my-agent \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "hello-id",
        "kind": "message",
        "role": "user",
        "parts": [{ "kind": "text", "text": "Hello!" }]
      }
    }
  }'
```

**Via the SDK:**

```typescript
import { createMessenger } from '@artinet/sdk';

const messenger = createMessenger({
    baseUrl: 'http://localhost:3000/agentId/my-agent',
});

// Send a message
const response = await messenger.sendMessage('Hello!');
console.log(response);

// Or stream the response
for await (const update of messenger.sendMessageStream('Tell me a story')) {
    console.log(update);
}
```

## Documentation

| Document                           | Description                        |
| ---------------------------------- | ---------------------------------- |
| [Settings](./docs/settings.md)     | Complete settings reference        |
| [Storage](./docs/storage.md)       | Storage backends and configuration |
| [Middleware](./docs/middleware.md) | Request/response interception      |
| [API Reference](./docs/api.md)     | Endpoints and JSON-RPC methods     |
| [Deployment](./docs/deployment.md) | Docker and production deployment   |

## API Reference

### Endpoints

| Method | Path                                       | Description          |
| ------ | ------------------------------------------ | -------------------- |
| POST   | `/deploy`                                  | Deploy a new agent   |
| POST   | `/test`                                    | Test an agent        |
| GET    | `/agentId/:id/.well-known/agent-card.json` | Get agent card       |
| POST   | `/agentId/:id`                             | JSON-RPC interaction |

### JSON-RPC Methods

| Method           | Description                   |
| ---------------- | ----------------------------- |
| `message/send`   | Send a message, get response  |
| `message/stream` | Send a message, stream events |
| `task/get`       | Get task status               |
| `task/cancel`    | Cancel a running task         |
| `resubscribe`    | Stream events                 |

## Architecture

```
@artinet/fleet
├── /express     # Express adapter
├── /hono        # Hono adapter
└── /sqlite      # SQLite storage adapter

Depends on:
├── @artinet/armada   # Core business logic
├── @artinet/sdk      # A2A protocol client/server
├── orc8              # Agent/Tool orchestration
├── agent-def         # Standardized Agent Definitions
├── openai            # OpenAI API Client
└── @mcp              # @modelcontextprotocol/sdk
```

## Testing

```bash
npm test
```

## License

Apache-2.0

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/the-artinet-project/artinet).
