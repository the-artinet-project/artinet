[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/easy-a2a.svg?logoColor=black)](https://www.npmjs.com/package/easy-a2a)
[![npm downloads](https://img.shields.io/npm/dt/easy-a2a.svg)](https://www.npmjs.com/package/easy-a2a)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/easy-a2a/badge.svg)](https://snyk.io/test/npm/easy-a2a)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/easy-a2a?style=social)](https://github.com/the-artinet-project/easy-a2a/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# easy-a2a

Turn any OpenAI-compatible API (OpenAI, HuggingFace, OpenRouter, local models, etc.) into an A2A agent.

No frills, frameworks or vendor lock-in.

The [Agent2Agent Protocol (A2A)](https://a2a-protocol.org/latest) is a standardized way to send messages and share context between AI Agents.

## Quickstart

```typescript
import a2a, { Task, getContent } from "easy-a2a";

const agent = a2a({
  baseURL: "https://your-api.com/api/v1",
  apiKey: "your-api-key",
})
  .ai("You are a helpful assistant.")
  .createAgent({
    agentCard: "MyAgent",
  });

const result: Task = await agent.sendMessage("Hello!");
console.log(getContent(result));
```

## Installation

```bash
npm install easy-a2a
```

## Features

- **Multi-Agent**: Easily connect to other agents
- **Build Fast**: Define your agents behaviour with chainable methods

## Table of Contents

- [easy-a2a](#easy-a2a)
  - [Quickstart](#quickstart)
  - [Installation](#installation)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Examples:](#examples)
    - [Multi-Agent:](#multi-agent)
    - [Workflow Builder:](#workflow-builder)
    - [Customization:](#customization)
    - [Deployment:](#deployment)
  - [Core Classes \& Functions](#core-classes--functions)
    - [`a2a(client, agents?)`](#a2aclient-agents)
      - [`.ai(body, options?)`](#aibody-options)
    - [Steps](#steps)
      - [`.text`](#text)
      - [`.file`](#file)
      - [`.data`](#data)
    - [`convertExecutor(executor)`](#convertexecutorexecutor)
  - [License](#license)
  - [Resources](#resources)

## Examples:

### Multi-Agent:

Create Multiple AI Agents in just a few lines of code. Reuse the same OpenAI client to avoid boilerplate.

```typescript
import a2a, { getContent } from "easy-a2a";
import { OpenAI } from "openAi";

// Reuse the same client
const client = new OpenAI({ apiKey: "your-api-key" });

const cooking_agent = a2a(client)
  .ai("You're a helpful assistant that makes great cooking recomendations.")
  .createAgent({ agentCard: "Cooking Agent" });

const hotel_agent = a2a(client)
  .ai("You are a helpful assistant that makes great hotel recomendations")
  .createAgent({ agentCard: "Hotel Agent" });

// Build an agent that can call other agents
const agent = a2a(client, {
  callerId: "main-agent",
  agents: new Map([
    ["cooking-agent", cooking_agent],
    ["hotel-agent", hotel_agent],
  ]),
})
  .ai("Use your agents to fulfill the users request.")
  .createAgent({ agentCard: "MainAgent" });

// Use your agent with the A2A protocol
await agent.sendMessage("What should I have for dinner tomorrow night?");
```

---

### Workflow Builder:

Add steps to process information and keep the caller updated.

```typescript
const agent = a2a({ apiKey: "your-api-key" })
  .text(({ content: userMessage })=> `Message Recieved: ${userMessage}`)
  .ai("Use the least amount of tokens to process the users.") // The ChatCompletion is passed to the next step
  .text(({ args, contextId })=> {
    const completion = args[0];
    if (completion.usage?.total_tokens > 1000) {
      return `You've run out of tokens for this request: ${contextId}`;
    }
    ...
  })
  .createAgent({ agentCard: "MyAgent" });
```

---

### Customization:

Customize each `.ai` call with familiar interfaces ( i.e. `OpenAI.ChatCompletionCreateParamsNonStreaming`, `OpenAI.RequestOptions`)

```typescript
const agent = a2a({ apiKey: "your-api-key" })
  .ai(
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Say Hello World! to every new user" },
      ],
      max_completion_tokens: 5000,
      tools: ...
    },
    {
      maxRetries: 2,
      includeHistory: false,
    }
  )
  .createAgent({ agentCard: "MyAgent" });
```

---

### Deployment:

Quickly turn your agent into an [`Express`](https://github.com/expressjs/express) server so it can receive A2A requests from anywhere.

```typescript
import { createAgentServer } from "easy-a2a";

const { app } = createAgentServer({
  agent: agent,
  basePath: "/a2a",
});

app.listen(3000, () => {
  console.log("MyAgent is running on http://localhost:3000/a2a");
});
```

## Core Classes & Functions

### `a2a(client, agents?)`

Creates a new agent builder with an OpenAI client and additional agents.

**Parameters:**

- `client`: [`OpenAI`](https://github.com/openai/openai-node/tree/master?tab=readme-ov-file) instance or `OpenAI.ClientOptions`
- `agents?`: Accepts an [`AgentRelay`](https://github.com/the-artinet-project/agent-relay), [`AgentRelayConfig`](https://github.com/the-artinet-project/agent-relay?tab=readme-ov-file#configuration-options), an [`A2AClient`](https://github.com/the-artinet-project/artinet-sdk?tab=readme-ov-file#client), or another [`Agent`](https://github.com/the-artinet-project/artinet-sdk?tab=readme-ov-file#client) instance for multi-agent communication.

#### `.ai(body, options?)`

Adds a step to the agents workflow that triggers a call to the target API.

**Parameters:**

- `body`: System prompt string or full `OpenAI.ChatCompletionCreateParams`
- `options?`: `OpenAI.RequestOptions` including the following flags for creating the `messages` array based to the llm:
  - `includeHistory`:`boolean`: Include the `Task.history` as `{ role: "assistant" | "user"; content: string; }[]`.
  - `includeArgs`:`boolean`: Include the `args` (see below) as `{ role: "system" as const, content: JSON.stringify(args) }`.
  - `includeContent`:`boolean`: Include the `content` (see below) as `{ role: "user"; content: "content"}`.

### Steps

Steps are **middleware-like** components that allow you to quickly create custom AgentExecutors without having to deal with protocol related boilerplate.

Each step expects to be passed a `StepFunction` -

**Parameters**:

- `content`:`string`: The main message text.
- `context`:`Context`: An object containing details about the agents runtime -
  - `contextId`:`string`: A unique identifier representing the current invocation.
  - `isCancelled()`:`boolean`: Returns a boolean indicating if a request was recieved to cancel the current [`Task`](https://a2a-protocol.org/latest/topics/life-of-a-task/#life-of-a-task).
  - `State()`:`Task`: Returns a `Task` indicating the current state of the agents execution.
- `command`: A [`MessageSendParams`](https://a2a-protocol.org/latest/specification/#711-messagesendparams-object) object that contains the entire A2A request.
- `args`:`unknown[]`: An array of arguments passed from the previous step.

Expects:

- [`Part`](https://a2a-protocol.org/latest/topics/life-of-a-task/#life-of-a-task)/`Part[]`/`Promise<Part>`/`Promise<Part[]>`/`{ parts: Part[]; args:unknown[]; }`/`Promise<{ parts: Part[]; args:unknown[]; }>`

**Example Format**:

```typescript
async ({ command, context, content, args }) => {
  return {
    parts: []
    args: []
  }
};
```

#### `.text`

A step that expects every returned `Part` to be a `string`.

#### `.file`

A step that expects every returned `Part` to be a `FilePart`:

```typescript
{
  name?: string;
  mimeType?: string;
  bytes?: string; // Cannot contain uri if this field is included
  uri?: string; // Cannot contain bytes if this field is included
}
```

#### `.data`

A step that expects every returned `Part` to be a `Record<string,unknown>`.

### `convertExecutor(executor)`

Converts an [`A2A.AgentExecutor`](https://a2a-protocol.org/latest/tutorials/python/4-agent-executor/#4-the-agent-executor)(from @a2a-js/sdk) into an easy to use [`AgentEngine`](https://github.com/the-artinet-project/artinet-sdk?tab=readme-ov-file#agentengine) for agent creation.

## License

Apache-2.0

## Resources

- [GitHub Repository](https://github.com/the-artinet-project/easy-a2a)
- [Issue Tracker](https://github.com/the-artinet-project/easy-a2a/issues)
