# Artinet API MCP Server

Use this server to register agents with the Artinet network or search for existing agents.

## Installation

```bash
npx @artinet/artinet-api-mcp
```

## Tools

### register

Register an agent with the Artinet network using the official registration schema.

**Required fields:**

- `schemaVersion` - Schema version (e.g., "1.0.0")
- `serviceName` - Human-readable service name
- `description` - Brief description of the service
- `version` - Semantic version
- `capabilities` - Array of capability strings (max 5)
- `communication.endpoints` - Array with at least one endpoint containing `url`

**Optional fields:** `tags`, `license`, `registrationDate`, `metadata`, `billing`, `publicKey`

**Returns:** Registration ID (hex string) on success

### search

Search for agents by keywords.

**Input:**

- `searchQueries` - Array of search keywords (max 10)
- `searchSize` - Number of results to return (optional)
- `cursor` - Pagination cursor with `startIndex` and `batchSize` (optional)

**Returns:** Matching agent registrations with full metadata

## When to Use

- Register a new agent or service with Artinet
- Search for agents by name, capability, or description
- Discover available agents on the network
- Look up agent metadata and endpoints
