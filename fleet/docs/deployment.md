# Deployment

This guide covers deploying Fleet to various environments including Docker, cloud platforms, and edge runtimes.

## Docker

Fleet includes a production-ready Dockerfile.

### Build the Image

```bash
docker build -t artinet-fleet .
```

### Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Required variables:

| Variable         | Description                               | Required |
| ---------------- | ----------------------------------------- | -------- |
| `OPENAI_API_KEY` | OpenAI API key for inference              | Yes      |
| `PORT`           | Server port (default: 3000)               | No       |
| `NODE_ENV`       | Environment (`production`, `development`) | No       |

Optional variables:

| Variable        | Description                                      |
| --------------- | ------------------------------------------------ |
| `INFERENCE_URL` | Custom OpenAI-compatible endpoint                |
| `DATABASE_PATH` | SQLite database path                             |
| `LOG_LEVEL`     | Logging level (`debug`, `info`, `warn`, `error`) |

### Run the Container

```bash
docker run --env-file .env -v fleet-data:/data -p 3000:3000 -e PORT=3000 artinet-fleet
```

### Example Setup

```typescript
import { fleet } from '@artinet/fleet/express';
import { SQLiteStore, AgentsTable } from '@artinet/fleet/sqlite';
import { Middleware } from '@artinet/fleet';
import { configure, configurePino, logger } from '@artinet/sdk';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import pino from 'pino';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { validateToken, decodeToken } from './token.js';

// Configure structured logging
configure({
    logger: configurePino(
        pino({
            level: process.env.LOG_LEVEL ?? 'info',
            ...(process.env.NODE_ENV === 'production' ? {} : { transport: { target: 'pino-pretty' } }),
        }),
    ),
});

// Setup database
const sqlite = new Database(process.env.DATABASE_PATH ?? '/data/fleet.db');
const db = drizzle<AgentsTable>(sqlite);

// Setup Express with security middleware
const app = express();
app.use(helmet());
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Configure Fleet
const server = fleet(
    {
        storage: new SQLiteStore(db),

        auth: async (req, res, next) => {
            const token = req.headers.authorization?.split(' ')[1];

            if (!token || !validateToken(token)) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            next();
        },

        user: async ({ request }) => {
            const token = request.headers.authorization?.split(' ')[1];
            return decodeToken(token).userId;
        },

        middleware: new Middleware().request(async ({ request, context }) => {
            logger.info('Request', { method: request.method, agentId: context.agentId });
            return request;
        }),
    },
    {
        app,
        authOnRetrieve: true,
        enableTesting: false, // Disable in production
    },
);

// Graceful shutdown
const httpServer = server.launch(Number(process.env.PORT) ?? 3000);

process.on('SIGTERM', () => {
    httpServer.close(() => {
        sqlite.close();
        process.exit(0);
    });
});
```
