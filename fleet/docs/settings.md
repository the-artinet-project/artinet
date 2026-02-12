# Settings

Fleet provides a comprehensive settings system that allows you to customize every aspect of your agent server. Settings are divided into base settings (shared across all adapters) and adapter-specific settings for Express and Hono.

## Quick Reference

```typescript
import { fleet } from '@artinet/fleet/express';

fleet({
    // Base settings
    storage: new InMemoryStore(),
    basePath: '/',
    agentPath: '/agentId',
    deploymentPath: '/deploy',
    testPath: '/test',
    inferenceProviderUrl: 'https://api.openai.com/v1',
    middleware: new Middleware(),

    // Express-specific
    user: async ({ request }) => request.headers['x-user-id'],
    auth: async (req, res, next) => {
        /* ... */ next();
    },
}).launch(3000);
```

## Base Settings

These settings are available for both Express and Hono adapters.

### storage

| Property  | Type         | Default         |
| --------- | ------------ | --------------- |
| `storage` | `IDataStore` | `InMemoryStore` |

The storage backend for agent configurations. Fleet includes two built-in storage options:

In-memory (default) - data lost on restart

```typescript
import { InMemoryStore } from '@artinet/fleet';

fleet({ storage: new InMemoryStore() });
```

SQLite - persistent storage

```typescript
import { SQLiteStore } from '@artinet/fleet/sqlite';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('fleet.db');
const db = drizzle(sqlite);
fleet({ storage: new SQLiteStore(db) });
```

See [Storage](./storage.md) for detailed configuration.

### basePath

| Property   | Type     | Default |
| ---------- | -------- | ------- |
| `basePath` | `string` | `"/"`   |

Base path prefix for all Fleet routes. Useful when mounting Fleet under a subpath.

```typescript
// Routes will be available at /api/v1/deploy, /api/v1/agentId/:id, etc.
fleet({ basePath: '/api/v1' });
```

### agentPath

| Property    | Type     | Default      |
| ----------- | -------- | ------------ |
| `agentPath` | `string` | `"/agentId"` |

Path prefix for agent interaction endpoints. Agent cards and JSON-RPC requests are served under this path.

```typescript
// Agent available at /agents/my-agent
fleet({ agentPath: '/agents' });
```

### fallbackPath

| Property       | Type     | Default           |
| -------------- | -------- | ----------------- |
| `fallbackPath` | `string` | `"/deploymentId"` |

Alternative path for agent requests. Provides compatibility with different A2A client implementations.

```typescript
fleet({ fallbackPath: '/remote-agents' });
```

### deploymentPath

| Property         | Type     | Default     |
| ---------------- | -------- | ----------- |
| `deploymentPath` | `string` | `"/deploy"` |

Endpoint for deploying new agents or updating existing ones.

```typescript
// Deploy agents at POST /api/agents
fleet({ deploymentPath: '/api/agents' });
```

### testPath

| Property   | Type     | Default   |
| ---------- | -------- | --------- |
| `testPath` | `string` | `"/test"` |

Endpoint for testing agent configurations before deployment.

```typescript
fleet({ testPath: '/temp-agents' });
```

### inferenceProviderUrl

| Property               | Type     | Default     |
| ---------------------- | -------- | ----------- |
| `inferenceProviderUrl` | `string` | `undefined` |

Custom OpenAI-compatible API endpoint for LLM inference. When not set, uses the default OpenAI API URL.

```typescript
// Use Azure OpenAI
fleet({
    inferenceProviderUrl: 'https://your-resource.openai.azure.com/openai/deployments/gpt-4',
});

// Use local Ollama
fleet({
    inferenceProviderUrl: 'http://localhost:11434/v1',
});

// Use Groq
fleet({
    inferenceProviderUrl: 'https://api.groq.com/openai/v1',
});
```

### middleware

| Property     | Type         | Default     |
| ------------ | ------------ | ----------- |
| `middleware` | `Middleware` | `undefined` |

Request/response interceptors for the agent route. See [Middleware](./middleware.md) for detailed usage.

```typescript
import { Middleware } from '@artinet/fleet';

fleet({
    middleware: new Middleware()
        .request(async ({ request, context }) => {
            console.log('Incoming:', request);
            return request;
        })
        .response(async ({ response, context }) => {
            console.log('Outgoing:', response);
            return response;
        }),
});
```

### load

| Property | Type           | Default     |
| -------- | -------------- | ----------- |
| `load`   | `loadFunction` | `loadAgent` |

Custom function for loading agent configurations into executable agents. Override this to implement custom agent initialization logic.

```typescript
import type { loadFunction } from '@artinet/fleet';
import { dock } from '@artinet/cruiser/openai';
import { Agent as OpenAIAgent } from '@openai/agents';

const customLoad: loadFunction = async (config, context) => {
    const agent = new OpenAIAgent({
        name: config.name,
        instructions: config.instructions,
        model: config.modelId,
    });
    return await dock(agent);
};

fleet({ load: customLoad });
```

- _Use `@artinet/cruiser` to dock Agents from other frameworks into your fleet._

### invoke

| Property | Type             | Default       |
| -------- | ---------------- | ------------- |
| `invoke` | `invokeFunction` | `invokeAgent` |

Custom function for invoking agents with requests. Override for custom request handling logic.

```typescript
import type { invokeFunction } from '@artinet/fleet';

const customInvoke: invokeFunction = async (request, agent, context) => {
    // Custom invocation logic
    // Must return AgentResponse
};

fleet({ invoke: customInvoke });
```

### get / set / test

| Property | Type                                  | Description                           |
| -------- | ------------------------------------- | ------------------------------------- |
| `get`    | `RequestAgentRoute["implementation"]` | Handler for agent retrieval requests  |
| `set`    | `CreateAgentRoute["implementation"]`  | Handler for agent deployment requests |
| `test`   | `TestAgentRoute["implementation"]`    | Handler for agent test requests       |

Override the core route implementations for complete control over request handling.

```typescript
fleet({
    get: async (request, context) => {
        // Custom agent retrieval logic
    },
    set: async (request, context) => {
        // Custom deployment logic
        return { agentId: request.config.uri, success: true };
    },
    test: async (request, context) => {
        // Custom test logic
    },
});
```

---

## Express Settings

These settings are specific to the Express adapter.

```typescript
import { fleet, type ExpressSettings } from '@artinet/fleet/express';
```

### Session

| Property  | Fields                        | Type                                                           |
| --------- | ----------------------------- | -------------------------------------------------------------- |
| `Session` | `{ request, response, next }` | `{ express.Request; express.Response; express.NextFunction; }` |

### user

| Property | Type                                    | Default             |
| -------- | --------------------------------------- | ------------------- |
| `user`   | `(session: Session) => Promise<string>` | Returns `"default"` |

Extracts the user ID from an incoming request. Used for multi-tenant agent isolation.

```typescript
fleet({
    user: async ({ request }) => {
        // Extract from JWT
        const token = request.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, secret);
        return decoded.userId;
    },
});
```

Or from a custom header

```typescript
fleet({
    user: async ({ request }) => (request.headers['x-user-id'] as string) ?? 'anonymous',
});
```

### auth

| Property | Type                                | Default     |
| -------- | ----------------------------------- | ----------- |
| `auth`   | `(req, res, next) => Promise<void>` | `undefined` |

Authentication middleware applied to protected routes (`/deploy`, `/test`, and optionally agent routes).

```typescript
fleet({
    auth: async (req, res, next) => {
        const token = req.headers.authorization;

        if (!token || !validateToken(token)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        next();
    },
});
```

### retrieve / deploy / evaluate

| Property   | Type                 | Description                         |
| ---------- | -------------------- | ----------------------------------- |
| `retrieve` | `agent.handler`      | Express handler for agent retrieval |
| `deploy`   | `deployment.handler` | Express handler for deployment      |
| `evaluate` | `testing.handler`    | Express handler for testing         |

Low-level Express request handlers. These are automatically generated from `get`, `set`, and `test` settings but can be overridden for complete control.

---

## Express Options

Options passed as the second argument to `fleet()`.

```typescript
fleet(settings, options);
```

### app

| Property | Type                  | Default     |
| -------- | --------------------- | ----------- |
| `app`    | `express.Application` | `express()` |

Pre-configured Express application. Use this to add custom middleware or integrate Fleet with an existing server.

```typescript
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Add custom routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

fleet({}, { app });
```

### authOnRetrieve

| Property         | Type      | Default |
| ---------------- | --------- | ------- |
| `authOnRetrieve` | `boolean` | `false` |

When `true`, applies the `auth` middleware to agent retrieval routes. Enable this in production for protected agents.

```typescript
fleet(
    {
        auth: async (req, res, next) => {
            /* ... */
        },
    },
    { authOnRetrieve: true },
);
```

### enableTesting

| Property        | Type      | Default |
| --------------- | --------- | ------- |
| `enableTesting` | `boolean` | `true`  |

When `true`, exposes the `/test` endpoint for agent evaluation. Disable in production if not needed.

```typescript
// Disable test endpoint in production
fleet({}, { enableTesting: process.env.NODE_ENV !== 'production' });
```

---

## Hono Settings

These settings are specific to the Hono adapter.

```typescript
import { fleet, type HonoSettings } from '@artinet/fleet/hono';
```

### Session

| Property  | Fields          | Type                           |
| --------- | --------------- | ------------------------------ |
| `Session` | `{ ctx, next }` | `{ hono.Context; hono.Next; }` |

### user

| Property | Type                                    | Default             |
| -------- | --------------------------------------- | ------------------- |
| `user`   | `(session: Session) => Promise<string>` | Returns `"default"` |

Extracts the user ID from the Hono context. Used for multi-tenant agent isolation.

```typescript
fleet({
    user: async ({ ctx }) => {
        // Extract from JWT via Hono's jwt middleware
        const payload = ctx.get('jwtPayload');
        return payload?.sub ?? 'anonymous';
    },
});
```

Or from a header

```typescript
fleet({
    user: async ({ ctx }) => ctx.req.header('x-user-id') ?? 'anonymous',
});
```

### auth

| Property | Type                                                    | Default     |
| -------- | ------------------------------------------------------- | ----------- |
| `auth`   | `(ctx: hono.Context, next: hono.Next) => Promise<void>` | `undefined` |

Authentication middleware applied to protected routes.

```typescript
import { HTTPException } from 'hono/http-exception';

fleet({
    auth: async (ctx, next) => {
        const token = ctx.req.header('authorization');

        if (!token || !validateToken(token)) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }

        await next();
    },
});
```

### retrieve / deploy / evaluate

| Property   | Type                 | Description                      |
| ---------- | -------------------- | -------------------------------- |
| `retrieve` | `agent.handler`      | Hono handler for agent retrieval |
| `deploy`   | `deployment.handler` | Hono handler for deployment      |
| `evaluate` | `testing.handler`    | Hono handler for testing         |

Low-level Hono request handlers.

---

## Hono Options

Options passed as the second argument to `fleet()`.

### app

| Property | Type        | Default      |
| -------- | ----------- | ------------ |
| `app`    | `hono.Hono` | `new Hono()` |

Pre-configured Hono application. Use this for custom middleware or edge runtime integration.

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();
app.use('*', cors());
app.use('*', logger());

// Add custom routes
app.get('/health', (c) => c.json({ status: 'ok' }));

fleet({}, { app });
```

### authOnRetrieve

| Property         | Type      | Default |
| ---------------- | --------- | ------- |
| `authOnRetrieve` | `boolean` | `false` |

When `true`, applies the `auth` middleware to agent retrieval routes.

### enableTesting

| Property        | Type      | Default |
| --------------- | --------- | ------- |
| `enableTesting` | `boolean` | `true`  |

When `true`, exposes the `/test` endpoint.

## Complete Example

```typescript
import { fleet } from '@artinet/fleet/express';
import { SQLiteStore, AgentsTable } from '@artinet/fleet/sqlite';
import { Middleware } from '@artinet/fleet';
import { configure, configurePino } from '@artinet/sdk';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import pino from 'pino';
import express from 'express';
import cors from 'cors';

// Configure logging
configure({
    logger: configurePino(pino({ level: 'info' })),
});

// Setup database
const sqlite = new Database('fleet.db');
const db = drizzle<AgentsTable>(sqlite);

// Setup Express app
const app = express();
app.use(cors());
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Configure Fleet
const server = fleet(
    {
        storage: new SQLiteStore(db),
        basePath: '/api/v1',
        inferenceProviderUrl: process.env.INFERENCE_URL,

        user: async ({ request }) => {
            const token = request.headers.authorization?.split(' ')[1];
            return token ? decodeToken(token).userId : 'anonymous';
        },

        auth: async (req, res, next) => {
            if (!req.headers.authorization) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            next();
        },

        middleware: new Middleware().request(async ({ request, context }) => {
            console.log(`[${context.requestId}] ${request.method}`);
            return request;
        }),
    },
    {
        app,
        authOnRetrieve: true,
        enableTesting: process.env.NODE_ENV !== 'production',
    },
);

server.launch(process.env.PORT ?? 3000);
```
