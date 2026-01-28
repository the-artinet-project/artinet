# Middleware

Fleet provides a middleware system for intercepting and transforming agent requests and responses. This enables logging, validation, authentication, rate limiting, and custom processing logic.

## Quick Start

```typescript
import { fleet } from '@artinet/fleet/express';
import { Middleware } from '@artinet/fleet';

fleet({
    middleware: new Middleware()
        .request(async ({ request, context }) => {
            console.log('Incoming request:', request.method);
            return request;
        })
        .response(async ({ response, context }) => {
            console.log('Outgoing response:', response.type);
            return response;
        }),
}).launch(3000);
```

## Middleware Class

The `Middleware` class provides a fluent API for building middleware chains.

### Import

```typescript
import { Middleware } from '@artinet/fleet';
```

### Methods

| Method                       | Description                       |
| ---------------------------- | --------------------------------- |
| `request(action, trigger?)`  | Add a request interceptor         |
| `response(action, trigger?)` | Add a response interceptor        |
| `build()`                    | Get the internal middleware array |

---

## Request Middleware

Request middleware runs before the agent processes a message.

### Basic Usage

```typescript
import { Middleware } from '@artinet/fleet';

const middleware = new Middleware().request(async ({ request, context }) => {
    // Inspect or modify the request
    console.log('Method:', request.method);
    console.log('Agent ID:', context.agentId);

    // Must return the request (modified or unchanged)
    return request;
});
```

### Action Parameters

| Parameter | Type             | Description                     |
| --------- | ---------------- | ------------------------------- |
| `request` | `AgentRequest`   | The incoming JSON-RPC request   |
| `context` | `RequestContext` | Request context with agent info |

### AgentRequest Type

```typescript
interface AgentRequest {
    method: string; // 'message/send', 'message/stream', etc.
    params: MessageSendParams | TaskQueryParams | TaskIdParams;
}
```

### RequestContext Type

```typescript
interface RequestContext {
    agentId: string;
    userId?: string;
    requestId?: string;
    timestamp?: string;
    headers?: Record<string, string>;
    storage: IDataStore;
    // ... additional context
}
```

---

## Response Middleware

Response middleware runs after the agent produces a response.

### Basic Usage

```typescript
import { Middleware } from '@artinet/fleet';

const middleware = new Middleware().response(async ({ response, context }) => {
    // Inspect or modify the response
    if (response.type === 'success') {
        console.log('Success:', response.result);
    }

    // Must return the response (modified or unchanged)
    return response;
});
```

### Action Parameters

| Parameter  | Type             | Description                     |
| ---------- | ---------------- | ------------------------------- |
| `response` | `AgentResponse`  | The outgoing response           |
| `context`  | `RequestContext` | Request context with agent info |

### AgentResponse Types

```typescript
type AgentResponse =
    | { type: 'success'; result: ResponseResult | AgentCard }
    | { type: 'error'; error: AgentError }
    | { type: 'stream'; stream: AsyncIterable<Task | Message | TaskStatusUpdateEvent | TaskArtifactUpdateEvent> };
```

---

## Conditional Middleware (Triggers)

Add a trigger function to conditionally execute middleware.

```typescript
import { Middleware } from '@artinet/fleet';

const middleware = new Middleware()
    .request(
        // Action
        async ({ request, context }) => {
            console.log('Processing send request');
            return request;
        },
        // Trigger - only runs for message/send
        ({ request, context }) => request.method === 'message/send',
    )
    .response(
        async ({ response, context }) => {
            console.log('Successful response');
            return response;
        },
        // Only runs for successful responses
        ({ response, context }) => response.type === 'success',
    );
```

- _If no trigger is provided, the middleware runs for every request/response._

---

## Chaining Middleware

Middleware is composable and sequential. Chain multiple handlers:

```typescript
import { Middleware } from '@artinet/fleet';

const middleware = new Middleware()
    // First request handler - logging
    .request(async ({ request, context }) => {
        console.log(`[${new Date().toISOString()}] ${request.method}`);
        return request;
    })
    // Second request handler - validation
    .request(async ({ request, context }) => {
        if (!request.params?.message) {
            throw new Error('Message required');
        }
        return request;
    })
    // First response handler - timing
    .response(async ({ response, context }) => {
        console.log(`Response type: ${response.type}`);
        return response;
    })
    // Second response handler - transformation
    .response(async ({ response, context }) => {
        if (response.type === 'success') {
            // Add metadata
            return {
                ...response,
                result: {
                    ...response.result,
                    _metadata: { processedAt: new Date().toISOString() },
                },
            };
        }
        return response;
    });
```

Execution order:

1. Request handlers run in order (first to last)
2. Agent processes the request
3. Response handlers run in order (first to last)

---

## Common Patterns

### Logging

```typescript
import { Middleware } from '@artinet/fleet';
import { logger } from '@artinet/sdk';

const loggingMiddleware = new Middleware()
    .request(async ({ request, context }) => {
        logger.info('Request received', {
            method: request.method,
            agentId: context.agentId,
            requestId: context.requestId,
        });
        return request;
    })
    .response(async ({ response, context }) => {
        logger.info('Response sent', {
            type: response.type,
            agentId: context.agentId,
            requestId: context.requestId,
        });
        return response;
    });
```

### Request Validation

```typescript
import { Middleware } from '@artinet/fleet';

const validationMiddleware = new Middleware().request(async ({ request, context }) => {
    // Validate message format
    if (request.method === 'message/send') {
        const message = request.params?.message;

        if (!message?.parts?.length) {
            throw new Error('Message must contain at least one part');
        }

        // Validate text length
        const textParts = message.parts.filter((p) => p.kind === 'text');
        const totalLength = textParts.reduce((sum, p) => sum + p.text.length, 0);

        if (totalLength > 10000) {
            throw new Error('Message too long (max 10000 characters)');
        }
    }

    return request;
});
```

### Content Filtering

```typescript
import { Middleware } from '@artinet/fleet';
import { filterProfanity } from './filters.js';

const filterMiddleware = new Middleware().response(async ({ response, context }) => {
    if (response.type !== 'success') {
        return response;
    }

    // Filter response content
    const result = response.result;
    if ('artifacts' in result) {
        result.artifacts = result.artifacts?.map((artifact) => ({
            ...artifact,
            parts: artifact.parts.map((part) => {
                if (part.kind === 'text') {
                    return {
                        ...part,
                        text: filterProfanity(part.text),
                    };
                }
                return part;
            }),
        }));
    }

    return { ...response, result };
});
```

### Rate Limiting

```typescript
import { Middleware } from '@artinet/fleet';

const rateLimits = new Map<string, number[]>();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 100;

const rateLimitMiddleware = new Middleware().request(async ({ request, context }) => {
    const userId = context.userId ?? 'anonymous';
    const now = Date.now();

    // Get request timestamps for this user
    const timestamps = rateLimits.get(userId) ?? [];

    // Remove old timestamps
    const recentTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

    if (recentTimestamps.length >= MAX_REQUESTS) {
        throw new Error('Rate limit exceeded');
    }

    // Add current timestamp
    recentTimestamps.push(now);
    rateLimits.set(userId, recentTimestamps);

    return request;
});
```

### Metrics Collection

```typescript
import { Middleware } from '@artinet/fleet';

interface Metrics {
    requests: number;
    successes: number;
    errors: number;
    latencies: number[];
}

const metrics: Map<string, Metrics> = new Map();

const metricsMiddleware = new Middleware()
    .request(async ({ request, context }) => {
        // Start timing
        (context as any)._startTime = Date.now();

        // Increment request count
        const agentMetrics = metrics.get(context.agentId) ?? {
            requests: 0,
            successes: 0,
            errors: 0,
            latencies: [],
        };
        agentMetrics.requests++;
        metrics.set(context.agentId, agentMetrics);

        return request;
    })
    .response(async ({ response, context }) => {
        const agentMetrics = metrics.get(context.agentId)!;
        const latency = Date.now() - (context as any)._startTime;

        agentMetrics.latencies.push(latency);

        if (response.type === 'success') {
            agentMetrics.successes++;
        } else if (response.type === 'error') {
            agentMetrics.errors++;
        }

        return response;
    });

// Expose metrics
function getMetrics(agentId: string): Metrics | undefined {
    return metrics.get(agentId);
}
```

### Request Enrichment

```typescript
import { Middleware } from '@artinet/fleet';

const enrichmentMiddleware = new Middleware().request(async ({ request, context }) => {
    if (request.method === 'message/send' && request.params?.message) {
        const message = request.params.message;

        // Add context to message
        const contextPart = {
            kind: 'data' as const,
            data: {
                userId: context.userId,
                timestamp: new Date().toISOString(),
                agentId: context.agentId,
            },
        };

        message.parts = [...message.parts, contextPart];
    }

    return request;
});
```

---

## Error Handling

Errors thrown in middleware are caught and returned as JSON-RPC errors:

```typescript
import { Middleware } from '@artinet/fleet';

const middleware = new Middleware().request(async ({ request, context }) => {
    if (!isAuthorized(context.userId, context.agentId)) {
        throw new Error('Not authorized to access this agent');
    }
    return request;
});
```

The client receives:

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
        "code": -32603,
        "message": "Not authorized to access this agent"
    }
}
```

---

## With Express/Hono Middleware

Fleet middleware works alongside Express/Hono middleware. Use framework middleware for HTTP-level concerns and Fleet middleware for agent-level concerns.

### Express

```typescript
import express from 'express';
import { fleet } from '@artinet/fleet/express';
import { Middleware } from '@artinet/fleet';

const app = express();

// Express middleware - HTTP level
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Fleet middleware - Agent level
const agentMiddleware = new Middleware().request(async ({ request }) => {
    console.log('Agent request:', request.method);
    return request;
});

fleet({ middleware: agentMiddleware }, { app }).launch(3000);
```

### Hono

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fleet } from '@artinet/fleet/hono';
import { Middleware } from '@artinet/fleet';

const app = new Hono();

// Hono middleware - HTTP level
app.use('*', cors());

// Fleet middleware - Agent level
const agentMiddleware = new Middleware().request(async ({ request }) => {
    console.log('Agent request:', request.method);
    return request;
});

fleet({ middleware: agentMiddleware }, { app }).launch(3000);
```
