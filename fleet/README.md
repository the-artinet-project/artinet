[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/fleet.svg?logoColor=black)](https://www.npmjs.com/package/@artinet/fleet)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/fleet/badge.svg)](https://snyk.io/test/npm/@artinet/fleet)

# @artinet/fleet

Deploy AI agents on any infrastructure.

Fleet is a lightweight server framework for hosting [A2A Protocol](https://github.com/google-a2a/A2A) agents with built-in orchestration, tool integration (MCP), and Agent2Agent communication.

> 🚧 **More servers coming soon** — Hono, Bun, and standalone adapters are on the roadmap.

## Installation

```bash
npm install @artinet/fleet express openai @modelcontextprotocol/sdk
```

**Requirements:** Node.js ≥ 18.9.1

## Quick Start

### 1. Launch a Fleet

Set an `OPENAI_API_KEY` in you environment variables, then start your Server.

```typescript
import { fleet } from "@artinet/fleet/express";

const { app } = fleet().launch(3000);
```

That's it. You now have:

- `POST /deploy` — Deploy agents
- `POST /test` — Test agent deployments
- `GET /agentId/:id/.well-known/agent-card.json` — Agent metadata
- `POST /agentId/:id` — JSON-RPC agent interaction

### 2. Deploy an Agent

**Prelaunch**:

```typescript
import { fleet } from "@artinet/fleet/express";

const myFleet = await fleet().ship([
  {
    config: {
      uri: "my-agent",
      ...
    },
  },
]);

myFleet.launch(3000);
```

**Ship**:

```typescript
import { ship } from "@artinet/fleet";

await ship("http://localhost:3000", {
    config: {
      uri: "my-agent",
      ...
    },
});
```

**Curl**:

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "name": "My Agent",
      "uri": "my-agent",
      "description": "A helpful assistant",
      "modelId": "gpt-4",
      "instructions": "You are a helpful assistant.",
      "version": "1.0.0",
      "skills": [],
      "capabilities" : {},
      "defaultInputModes": ["text"],
      "defaultOutputModes": ["text"],
      "services": [{
        "type": "mcp",
        "uri": "everything-server-1",
        "info": {
          "uri": "everything-server-1",
          "implementation": {
            "version": "0.0.1",
            "name": "everything"
          }
        },
        "arguments": {
          "command": "npx",
          "args": [
            "-y",
            "@modelcontextprotocol/server-everything@2025.11.25"
          ]
        }
      }]
    }
  }'
```

> 🚧 Coming Soon: Support for Remote MCP Servers.

### 3. Talk to Your Agent

via curl:

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

or via the [sdk](https://github.com/the-artinet-project/artinet-sdk):

```typescript
import { A2AClient } from "@artinet/sdk";

const client = new A2AClient("http://localhost:3000/agentId/my-agent");

// Send a message
const response = await client.sendMessage("Hello!");

console.log(response);

// Or stream the response
for await (const update of client.sendStreamingMessage("Tell me a story")) {
  console.log(update);
}
```

<!-- ## Custom Handlers

```typescript
import { fleet, InMemoryStore } from "@artinet/fleet/express";

const storage = new InMemoryStore();

const app = fleet(
  {
    storage,

    // Custom agent retrieval
    get: async (request, context) => {
      const agent = await storage.get(context.agentId);
      // ... return response
    },

    // Custom deployment logic
    set: async (request, context) => {
      await storage.set(request.config.uri, request.config);
      return { agentId: request.config.uri, success: true };
    },
  },
  {
    // Optional auth middleware
    auth: async (req, res, next) => {
      if (validateToken(req.headers.authorization)) {
        next();
      } else {
        res.status(401).json({ error: "Unauthorized" });
      }
    },
  }
);

app.listen(3000);
``` -->

## Configuration

| Option                 | Type         | Default         | Description                                                                                                                     |
| ---------------------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `storage`              | `IDataStore` | `InMemoryStore` | Agent storage backend (storage adapters coming soon)                                                                            |
| `basePath`             | `string`     | `"/"`           | Base path for all routes                                                                                                        |
| `agentPath`            | `string`     | `"/agentId"`    | Agent interaction path                                                                                                          |
| `deploymentPath`       | `string`     | `"/deploy"`     | Deployment endpoint                                                                                                             |
| `testPath`             | `string`     | `"/test"`       | Test endpoint                                                                                                                   |
| `inferenceProviderUrl` | `string`     | `undefined`     | An OpenAI API compatible endpoint                                                                                               |
| `load`                 | `function`   | `loadAgent`     | Returns an A2A Protocol compliant agent wrapped in the [`@artinet/sdk`](<(https://github.com/the-artinet-project/artinet-sdk)>) |

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
| `resubscribe`    | stream events                 |

## Architecture

```

@artinet/fleet
├── /express # Express adapter (current)
├── /hono # Coming soon
└── /bun # Coming soon

Depends on:
├── @artinet/armada # Core business logic
├── @artinet/sdk # A2A protocol client/server
├── orc8 # Agent orchestration
├── agent-def # Standardized Agent Definitions
├── openai # OpenAI API Client
└── @mcp # @modelcontextprotocol/sdk

```

## Testing

```bash
npm test
```

## License

Apache-2.0

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/the-artinet-project/fleet).
