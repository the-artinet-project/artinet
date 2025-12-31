#!/usr/bin/env node
import { BashServer } from "../src/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const args = process.argv.slice(2);
const bannedCommands = args.length > 0 ? args : undefined;
if (bannedCommands === undefined) {
  console.error("Usage: mcp-server-bash [banned-commands...]");
}
const server = new BashServer(
  {
    name: "bash-mcp-server",
    version: "1.0.0",
  },
  {},
  bannedCommands
);

async function runServer() {
  console.error("Starting Bash Server on stdio...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error(error.stack ?? error);
  console.error("Error starting Bash Server on stdio: ", error);
  process.exit(1);
});
