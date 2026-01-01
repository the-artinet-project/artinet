[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/agent-relay.svg)](https://www.npmjs.com/package/@artinet/agent-relay)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/agent-relay.svg)](https://www.npmjs.com/package/@artinet/agent-relay)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/agent-relay/badge.svg)](https://snyk.io/test/npm/@artinet/agent-relay)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/agent-relay?style=social)](https://github.com/the-artinet-project/agent-relay/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# Agent Relay

A library that enables AI agents to discover and communicate with other [A2A (Agent-to-Agent)](https://github.com/a2aproject/A2A) enabled AI agents via the [@artinet/sdk](https://github.com/the-artinet-project/artinet-sdk).

## Features

- **Automatic Agent Discovery**: Scans network ports to discover available agents
- **Multi-Agent Orchestration**: Coordinate tasks across multiple specialized agents
- **Message Relay**: Send messages to agents and receive responses with full task context
- **Task Management**: Query task status and cancel running tasks
- **Agent Discovery**: View and search agents by name, description, or skills

## Installation

```bash
npm install @artinet/agent-relay
```

## Usage

\*We recommend allocating a small port range because port scanning is resource intensive.

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

### Quickstart

```typescript
import { AgentBuilder, createAgentServer, SendMessageSuccessResult } from "@artinet/sdk";
import { AgentRelay } from "@artinet/agent-relay";

// create and start an Agent Server
const agentServer = createAgentServer({
    agent: AgentBuilder()
      .text(() => "hello world!")
      .createAgent({
        agentCard: {
          name: "test-agent",
          skills: [{
              name: "calculator",
              ...
            }],
          ...
        },
      }),
  });

const server = agentServer.app.listen(3001, () => {
  console.log("test-agent started on port 3001");
});

// Create a relay instance
const relay: AgentRelay = await AgentRelay.create({
  callerId: "caller-id", // The callers unique ID
  scanConfig: {
    host: "localhost",
    startPort: 3000,
    endPort: 3100,
  },
  syncInterval: 2500, // Rescan every 2.5 seconds
});

// Send a message to an agent
const response: SendMessageSuccessResult = await relay.sendMessage({ agentId: "test-agent", messageSendParams: {
  message: {
    role: "user",
    kind: "message",
    parts: [{ kind: "text", text: "Hello!" }],
    messageId: "msg-123",
  },
}});

// Clean up when done
await relay.close();
```

**List the available agents**

```typescript
const agentIds: string[] = await relay.getAgentIds();
console.log("Available agents:", agentIds);
```

**Search for agents by name, description, or skills**

```typescript
const agents: AgentCard[] = await relay.searchAgents({ query: "calculator" });
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## Requirements

- [Node.js](https://nodejs.org/en/download) ≥ 18.9.1
  - Recommended: 20 || ≥ 22

## License

Apache-2.0

## References

- [A2A Protocol Documentation](https://artinet.io)
- [Artinet SDK](https://github.com/the-artinet-project/sdk)
