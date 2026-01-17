import { cr8 } from "@artinet/sdk";
import { demoAgent } from "./agent.js";
import { agentCard, launchAsk } from "./lib/index.js";

// Create a server
const { app } = cr8(agentCard, {
  // Custom agent card path
  agentCardPath: "/.well-known/agent-card.json",

  // Base path for the API endpoint
  basePath: "/a2a",

  // CORS options
  corsOptions: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },
}).serve(demoAgent);

// Start the server
app.listen(3000, () => {
  console.log("A2A Agent started on port 3000");
  if (process.argv.includes("--with-chat")) {
    launchAsk();
  } else {
    console.log("Try connecting with an A2A client:");
    console.log("  Endpoint: http://localhost:3000/a2a");
    console.log(
      "  Agent Card: http://localhost:3000/.well-known/agent-card.json"
    );
    console.log(
      '\n💡 Tip: Run with "--with-chat" to automatically start an ask client'
    );
  }
});
