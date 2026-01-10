<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/fleet"><img src="https://img.shields.io/npm/v/@artinet/fleet?color=black" alt="Version"></a>
<a href="https://www.npmjs.com/package/@artinet/fleet"><img src="https://img.shields.io/npm/dt/@artinet/fleet?color=black" alt="Downloads"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://snyk.io/test/npm/@artinet/fleet"><img src="https://snyk.io/test/npm/@artinet/fleet/badge.svg" alt="Known Vulnerabilities"></a>
</p>
<h1 align="center"><em>fleet</em></h1>

Deploy AI agents on any infrastructure.

Fleet is a lightweight server framework for hosting agents with built-in orchestration, tool integration (MCP), and Agent2Agent communication.

## Installation

```bash
npm install @artinet/fleet openai @modelcontextprotocol/sdk @a2a-js/sdk
```

**Requirements:** Node.js ≥ 18.9.1

## Quick Start

### 1. Launch a Fleet

Set an `OPENAI_API_KEY` in you environment variables, then start your Server.

**Express**:

```bash
npm install express
```

```typescript
import { fleet } from "@artinet/fleet/express";

fleet().launch(3000);
```

**Hono**:

```bash
npm install hono
```

```typescript
import { fleet } from "@artinet/fleet/hono";

fleet().launch(3000);
```

> 🚧 **More servers coming soon** — Bun adapters and edge support are on the roadmap.

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

**Post Launch, Ship**:

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
import { createMessenger } from "@artinet/sdk";

const messenger = createMessenger({
  baseUrl: "http://localhost:3000/agentId/my-agent",
});

// Send a message
const response = await messenger.sendMessage("Hello!");

console.log(response);

// Or stream the response
for await (const update of messenger.sendMessageStream("Tell me a story")) {
  console.log(update);
}
```

### SQLite Storage

Set up a SQLite Database with [drizzle](https://www.npmjs.com/package/drizzle-orm):

```bash
npm install drizzle-orm better-sqlite3
```

```typescript
import { SQLiteStore, AgentsTable } from "@artinet/fleet/sqlite";
import { fleet } from "@artinet/fleet/hono";
/*Use any drizzle compatible Database*/
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database("fleet.db");
const db = drizzle<AgentsTable>(sqlite);

fleet({
  storage: new SQLiteStore(db),
}).launch(3000);
```

### Logging

Setup a custom logger via the [@artinet/sdk](https://www.npmjs.com/package/@artinet/sdk):

```bash
npm install @artinet/sdk pino pino-pretty
```

```typescript
import { configure } from "@artinet/sdk";
import { configurePino } from "@artinet/sdk/pino";
import pino from "pino";

configure({
  logger: configurePino(
    pino({
      level: "info",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    })
  ),
});
```

### Middleware

Intercept and transform agent requests and responses by adding `Middleware`:

```typescript
import { fleet } from "@artinet/fleet/express";
import { Middleware } from "@artinet/fleet";

fleet({
  middleware: new Middleware()
    .request(async ({ request, context }) => {
      // Inspect or transform incoming requests
      console.log("Incoming request:", request);
      return request;
    })
    .response(
      async ({ response, context }) => {
        // Inspect or transform outgoing responses
        console.log("Outgoing response:", response);
        return response;
      },
      // Use a trigger function to determine if the middleware should fire (defaults to `true` for every request/response)
      ({ response, context }) => {
        return true;
      }
    ),
}).launch(3000);
```

The middleware chain is composable & sequential; add multiple `request` or `response` handlers as needed. Each handler receives the current request/response and context, and must return the (optionally modified) value.

## [Docker Configuration](https://github.com/the-artinet-project/artinet/blob/main/fleet/dockerfile)

Build the docker image:

```bash
docker build -t artinet-fleet .
```

Copy the example and fill in your values:

```bash
cp .env.example .env
# Edit .env with your API keys
```

Run:

```bash
docker run --env-file .env -v fleet-data:/data -p 3000:3000 -e PORT=3000 artinet-fleet
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

## Settings

| Option                 | Type         | Default                        | Description                                                                                                                     |
| ---------------------- | ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `storage`              | `IDataStore` | `InMemoryStore`, `SQLiteStore` | Agent storage backend (storage adapters coming soon)                                                                            |
| `basePath`             | `string`     | `"/"`                          | Base path for all routes                                                                                                        |
| `agentPath`            | `string`     | `"/agentId"`                   | Agent interaction path                                                                                                          |
| `deploymentPath`       | `string`     | `"/deploy"`                    | Deployment endpoint                                                                                                             |
| `testPath`             | `string`     | `"/test"`                      | Test endpoint                                                                                                                   |
| `inferenceProviderUrl` | `string`     | `undefined`                    | An OpenAI API compatible endpoint                                                                                               |
| `load`                 | `function`   | `loadAgent`                    | Returns an A2A Protocol compliant agent wrapped in the [`@artinet/sdk`](<(https://github.com/the-artinet-project/artinet-sdk)>) |
| `middleware`           | `Middleware` | `undefined`                    | Request/response interceptors for the agent route                                                                               |

## API Reference

### Endpoints

| Method | Path                                       | Description          |
| ------ | ------------------------------------------ | -------------------- |
| POST   | `/deploy`                                  | Deploy a new agent   |
| POST   | `/test`                                    | Test a new agent     |
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
├── /express # Express adapter
├── /hono # Hono adapter
└── /bun # Coming soon

Depends on:
├── @artinet/armada # Core business logic
├── @artinet/sdk # A2A protocol client/server
├── orc8 # Agent/Tool orchestration
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
