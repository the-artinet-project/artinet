# Storage

Fleet uses a pluggable storage system for persisting agent configurations. Choose from built-in storage backends or implement your own.

## Quick Start

```typescript
import { fleet } from '@artinet/fleet/express';
import { InMemoryStore } from '@artinet/fleet';

// Defaults to in-memory storage
fleet().launch(3000);
```

## InMemoryStore

The default storage backend. Data is stored in memory and lost when the server restarts.

```typescript
import { fleet } from '@artinet/fleet/express';
import { InMemoryStore } from '@artinet/fleet';

const storage = new InMemoryStore();

fleet({ storage }).launch(3000);
```

---

## SQLiteStore

Persistent storage using SQLite with Drizzle ORM. Recommended for production single-instance deployments.

### Installation

```bash
npm install drizzle-orm better-sqlite3
npm install -D @types/better-sqlite3
```

### Basic Usage

```typescript
import { fleet } from '@artinet/fleet/express';
import { SQLiteStore, AgentsTable, agentsTable } from '@artinet/fleet/sqlite';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('fleet.db');
const db = drizzle<AgentsTable>(sqlite);

fleet({
    storage: new SQLiteStore(db),
}).launch(3000);
```

### Table Schema

The SQLite store automatically creates a `fleet_agents` table with the following schema:

| Column          | Type               | Description                  |
| --------------- | ------------------ | ---------------------------- |
| `uri`           | `TEXT PRIMARY KEY` | Unique agent identifier      |
| `name`          | `TEXT NOT NULL`    | Agent display name           |
| `version`       | `TEXT NOT NULL`    | Semantic version             |
| `updatedAt`     | `TEXT NOT NULL`    | ISO timestamp of last update |
| `status`        | `TEXT NOT NULL`    | `"ACTIVE"` or `"INACTIVE"`   |
| `visibility`    | `TEXT NOT NULL`    | `"PUBLIC"` or `"PRIVATE"`    |
| `owner`         | `TEXT NOT NULL`    | Owner user ID                |
| `configuration` | `TEXT`             | JSON-serialized agent config |

### Manual Table Creation

If you need to create the table manually:

```typescript
import { createAgentsTable, AgentsTable } from '@artinet/fleet/sqlite';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('fleet.db');
const db = drizzle<AgentsTable>(sqlite);

await createAgentsTable(db);
```

## Custom Storage

Implement the `IDataStore` interface to create custom storage backends.

### Interface

```typescript
import * as armada from '@artinet/armada';

interface IDataStore<T extends armada.StoredAgent = armada.StoredAgent> {
    get(id: string): Promise<T | undefined>;
    set(id: string, data: T): Promise<void>;
    delete(id: string): Promise<void>;
    search(query: string): Promise<T[]>;
}
```

### StoredAgent Type

```typescript
interface StoredAgent {
    uri: string;
    name: string;
    version: string;
    updatedAt: string;
    status: 'ACTIVE' | 'INACTIVE';
    visibility: 'PUBLIC' | 'PRIVATE';
    owner: string;
    configuration?: AgentConfiguration;
}
```

## Caching with InMemoryStore

For high-performance scenarios, extend `InMemoryStore` to add caching on top of persistent storage:

```typescript
import { InMemoryStore } from '@artinet/fleet';
import * as armada from '@artinet/armada';

class CachedStore extends InMemoryStore {
    constructor(private readonly backend: armada.IDataStore<armada.StoredAgent>) {
        super();
    }

    override async get(id: string): Promise<armada.StoredAgent | undefined> {
        // Check cache first
        let agent = await super.get(id);

        if (!agent) {
            // Cache miss - fetch from backend
            agent = await this.backend.get(id);
            if (agent) {
                await super.set(id, agent);
            }
        }

        return agent;
    }

    override async set(id: string, data: armada.StoredAgent): Promise<void> {
        // Write to both cache and backend
        await Promise.all([super.set(id, data), this.backend.set(id, data)]);
    }

    override async delete(id: string): Promise<void> {
        await Promise.all([super.delete(id), this.backend.delete(id)]);
    }

    override async search(query: string): Promise<armada.StoredAgent[]> {
        // Search backend directly
        return this.backend.search(query);
    }
}
```

---

## Storage Selection Guide

| Storage         | Use Case                   | Persistence |
| --------------- | -------------------------- | ----------- |
| `InMemoryStore` | Development, testing       | No          |
| `SQLiteStore`   | Single-instance production | Yes         |
