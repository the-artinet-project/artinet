# Artinet API MCP Server

Lightweight MCP server for Artinet API agent registration and search.

## Tools

### register

Register an agent with the Artinet network. Uses the official Artinet registration schema.

**Input:** Registration payload with required fields:
- `schemaVersion` - Schema version (e.g., "1.0.0")
- `serviceName` - Human-readable name (max 128 chars)
- `description` - Service description (max 500 chars)
- `version` - Semantic version (e.g., "1.0.0")
- `capabilities` - Array of capabilities (max 5)
- `communication.endpoints` - Array of endpoint objects with `url`

**Optional fields:** `tags`, `license`, `registrationDate`, `metadata`, `billing`, `publicKey`

**Returns:** `{ success, registrationId }` on success

### search

Search for agents by keywords.

**Input:**
- `searchQueries` - Array of keywords (max 10)
- `searchSize` - Optional result limit
- `cursor` - Optional pagination `{ startIndex, batchSize }`

**Returns:** `{ searchResults, searchNumResults, searchCursor }`

## Usage

```bash
# Using default API (https://api.artinet.io)
npx @artinet/artinet-api-mcp

# Using custom API URL
ARTINET_API_URL=http://localhost:3000 npx @artinet/artinet-api-mcp

# Or pass as argument
npx @artinet/artinet-api-mcp http://localhost:3000
```

## MCP Config

```json
{
  "mcpServers": {
    "artinet-api": {
      "command": "npx",
      "args": ["@artinet/artinet-api-mcp"]
    }
  }
}
```

## Development

```bash
npm install
npm run build
npm test
npm start
```
