[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/agent-relay-mcp.svg)](https://www.npmjs.com/package/@artinet/agent-relay-mcp)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/agent-relay-mcp.svg)](https://www.npmjs.com/package/@artinet/agent-relay-mcp)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/agent-relay-mcp/badge.svg)](https://snyk.io/test/npm/@artinet/agent-relay-mcp)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/mcp?style=social)](https://github.com/the-artinet-project/mcp/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# Agent Relay MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that enables AI agents to discover and communicate with other [A2A (Agent-to-Agent)](https://github.com/a2aproject/A2A) enabled AI agents through the [@artinet/sdk](https://github.com/the-artinet-project/artinet-sdk) and [@artinet/agent-relay](https://github.com/the-artinet-project/agent-relay).

## Features

- **Automatic Agent Discovery**: Scans network ports to discover available agents
- **Multi-Agent Orchestration**: Coordinate workflows across multiple specialized agents
- **Message Relay**: Send messages to agents and receive responses with full task context
- **Task Management**: Query task status and cancel running tasks
- **Agent Discovery**: View and search agents by name, description, or skills

## Installation

```bash
npm install @artinet/agent-relay-mcp
```

## Usage

### Commandline

```bash
npx @artinet/agent-relay-mcp [callerId] [startPort] [endPort] [scanning-threads]
```

Example:

```bash
npx @artinet/agent-relay-mcp my-assistant 3000 3100 10
```

\*We recommend allocating a small port range because port scanning is resource intensive.

### As an MCP Server

```typescript
import { RelayServer } from "@artinet/agent-relay-mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new RelayServer({
  name: "agent-relay-server",
  version: "0.0.1",
});

await server.init({
  callerId: "my-assistant-name",
  scanConfig: {
    host: "localhost",
    startPort: 3000,
    endPort: 3100,
    threads: 10,
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Reference

The server exposes six tools for agent interaction:

### `sendMessage`

Send a message to an agent and receive a response.

| Parameter | Type   | Description                                 |
| --------- | ------ | ------------------------------------------- |
| `agentId` | string | The ID of the agent to send the message to  |
| `message` | string | The message content to send                 |
| `taskId`  | string | (Optional) Task ID to continue conversation |

### `getTask`

Get the current status of a running task.

| Parameter | Type   | Description                 |
| --------- | ------ | --------------------------- |
| `agentId` | string | The ID of the agent         |
| `taskId`  | string | The ID of the task to query |

### `cancelTask`

Cancel a running task.

| Parameter | Type   | Description                  |
| --------- | ------ | ---------------------------- |
| `agentId` | string | The ID of the agent          |
| `taskId`  | string | The ID of the task to cancel |

### `getAgentCard`

Get detailed information about an agent, including its capabilities and skills.

| Parameter | Type   | Description         |
| --------- | ------ | ------------------- |
| `agentId` | string | The ID of the agent |

### `viewAgents`

List all registered agents available to the relay.

### `searchAgents`

Search for agents by name, description, or skills.

| Parameter | Type   | Description                     |
| --------- | ------ | ------------------------------- |
| `query`   | string | Search query (case-insensitive) |

## Configuration

### Environment Variables

- `ARTINET_RELAY_SYNC_INTERVAL`: Agent discovery sync interval in milliseconds (default: 2500)

### Configuration Options

```typescript
interface AgentRelayConfig {
  callerId: string; // Unique identifier for this relay instance (ensures the agent cannot call itself)
  syncInterval?: number; // Sync interval in ms (default: 2500)
  scanConfig?: {
    host?: string; // Host to scan (default: "localhost")
    startPort?: number; // Starting port (default: 3000)
    endPort?: number; // Ending port (default: 3100)
    threads?: number; // Concurrent scan threads (default: 10)
    fallbackPath?: string; // Agent card fallback path (default: "/.well-known/agent-card.json")
  };
}
```

## How It Works

1. **Discovery**: The relay scans a port range (default: 3000-3100) to find agents that expose A2A endpoints
2. **Registration**: Discovered agents are registered and their capabilities are cached
3. **Synchronization**: Periodic sync keeps the agent registry up-to-date
4. **Relay**: Messages are forwarded to appropriate agents based on agent IDs
5. **Task Management**: Task status and cancellation are handled through the relay interface

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## License

Apache-2.0

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [A2A Protocol Documentation](https://artinet.io)
- [Artinet SDK](https://github.com/the-artinet-project/sdk)
