import { A2AServer, InMemoryTaskStore } from "@artinet/sdk";
import { demoAgent } from "./agent.js";
import { agentCard } from "./lib/card.js";

// Create a server
const server = new A2AServer({
  // Use in-memory storage (no persistence between restarts)
  handler: demoAgent,
  taskStore: new InMemoryTaskStore(),
  // Customize the port
  port: 3000,

  // Base path for the API endpoint
  basePath: "/api",

  // CORS options
  corsOptions: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },

  // Customize the agent card
  card: agentCard,
});

// Start the server
server.start();
console.log("A2A Server started on port 3000");
console.log("Try connecting with an A2A client:");
console.log("  A2A Endpoint: http://localhost:3000/api");
console.log("  Agent Card: http://localhost:3000/.well-known/agent.json");
