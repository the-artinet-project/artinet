#!/usr/bin/env node
import { Relay, Discover } from "@artinet/agent-relay";
import { cr8 } from "@artinet/sdk";

const relay = await Relay.create({
  callerId: "test-caller",
});
const agent = cr8("TestAgent").text("ok").agent;
await relay.registerAgent(agent);
console.log("✓ Agent registered");
const agentServer = cr8("TestAgent").text("ok").server;
agentServer.app.listen(3000, () => {});
await new Promise((resolve) => setTimeout(resolve, 1000));
console.log("✓ Server started");
const discoverableRelay = await Discover.create({
  callerId: "test-caller",
  host: "localhost",
  startPort: 3000,
  endPort: 5000,
  syncInterval: 2500,
});
console.log("✓ Discoverable relay created");
const count = discoverableRelay.count;
console.log("✓ Count retrieved");
if (count !== 1) {
  console.error("Error: Count is not 1");
  process.exit(1);
}
console.log("✓ Count is 1");
process.exit(0);
