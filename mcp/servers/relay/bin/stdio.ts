#!/usr/bin/env node
import { AgentRelayConfig, RelayServer } from "../src/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const args = process.argv.slice(2);
const commands = args.length > 0 ? args : undefined;
if (commands === undefined || commands.length < 1) {
  console.error(
    "Usage: agent-relay-server [callerId] [startPort] [endPort] [threads]"
  );
}

if (!commands?.[0]) {
  console.error("Caller ID is required");
  process.exit(1);
}
const SYNC_INTERVAL = process.env.ARTINET_RELAY_SYNC_INTERVAL
  ? parseInt(process.env.ARTINET_RELAY_SYNC_INTERVAL)
  : 2500;

const callerId = commands[0];
const config: AgentRelayConfig = {
  callerId: callerId,
  syncInterval: SYNC_INTERVAL,
  scanConfig: {
    host: "localhost",
    startPort: commands?.[1] ? parseInt(commands[1]) : 3000,
    endPort: commands?.[2] ? parseInt(commands[2]) : 3100,
    threads: commands?.[3] ? parseInt(commands[3]) : 10,
    fallbackPath: "/.well-known/agent-card.json",
  },
};

const server = new RelayServer(
  {
    name: "agent-relay-server",
    version: "0.0.1",
  },
  {}
);

async function runServer() {
  console.error("Starting Agent Relay MCP Server on stdio...");
  await server.init(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error(error.stack ?? error);
  console.error("Error starting Agent Relay MCP Server on stdio: ", error);
  process.exit(1);
});
