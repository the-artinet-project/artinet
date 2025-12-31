[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/orc8.svg)](https://www.npmjs.com/package/orc8)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/router.svg)](https://www.npmjs.com/package/orc8)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/orc8/badge.svg)](https://snyk.io/test/npm/orc8)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/orc8?style=social)](https://github.com/the-artinet-project/orc8/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# orc8

Dynamic orchestration for A2A agents and MCP tools.

## Installation

```bash
npm install orc8 @modelcontextprotocol/sdk openai
```

## Quick Start

```typescript
import { orc8 } from "orc8";
import { openaiProvider } "orc8/openai";

const orchestrator = orc8.create({
  modelId: "gpt-4o",
  provider: openaiProvider({ apiKey: process.env.OPENAI_API_KEY }),
});

// Add MCP tools
orchestrator.add({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
});

// Connect and get a response
const response = await orchestrator.connect("List files in /tmp");
console.log(response);

// Clean up
await orchestrator.stop();
```

## Adding Agents

```typescript
orchestrator.add({
  engine: async function* (context) {
    yield {
      kind: "status-update",
      status: {
        state: "completed",
        message: {
          kind: "message",
          role: "agent",
          parts: [
            {
              kind: "text",
              text: `Hello from agent!`,
            },
          ],
          messageId: "msg-1",
        },
      },
      taskId: context.taskId,
      contextId: context.contextId,
      final: true,
    };
  },
  agentCard: {
    name: "EchoAgent",
    description: "Echoes back every request",
  },
});

const result = await orchestrator.connect("Say hello");
```

## Events

```typescript
orchestrator.events.on("update", (data) => {
  console.log("Update:", data);
});

orchestrator.events.on("error", (error, task) => {
  console.error(`Error in ${task.id}:`, error);
});
```

## Expose as an A2A Agent

```typescript
const agent = orchestrator.agent;

await agent.sendMessage("Hello, World!");
```

## OpenAI Provider

Use OpenAI (or any OpenAI-compatible API) as your LLM backend:

```typescript
import { orc8 } from "orc8";
import { openaiProvider } "orc8/openai";

const orchestrator = orc8.create({
  modelId: "gpt-4o",
  provider: openaiProvider({ apiKey: process.env.OPENAI_API_KEY }),
});

// Add tools and agents as usual
orchestrator.add({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
});

const response = await orchestrator.connect("List files in /tmp");
```

Works with any OpenAI-compatible APIs by setting the base URL:

```typescript
const provider = openaiProvider({
  apiKey: process.env.API_KEY,
  baseURL: "https://api.openrouter.ai/v1", // or any compatible endpoint
});
```

## Custom Provider

Bring your own LLM backend:

```typescript
import { orc8, type APIProvider } from "orc8";

const provider: APIProvider = async (request, signal) => {
  const response = await myLLM.chat(request.messages, { signal });
  return {
    agentResponse: response.content,
    timestamp: new Date().toISOString(),
    options: {
      tools: { requests: response.toolCalls ?? [] },
      agents: { requests: response.agentCalls ?? [] },
    },
  };
};

const orchestrator = orc8.create({ modelId: "my-model", provider });
```

## License

Apache-2.0
